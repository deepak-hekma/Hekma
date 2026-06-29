export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceIds?: string[];
  createdAt: number;
}

export interface ChatResponse {
  content: string;
  sourceIds: string[];
}

function extractSources(raw: string): { content: string; sourceIds: string[] } {
  // Look for a trailing "SOURCES: id1, id2" line.
  const match = raw.match(/\n?\s*SOURCES:\s*([^\n]+)\s*$/i);
  if (!match) return { content: raw.trim(), sourceIds: [] };
  const ids = match[1]
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s);
  const content = raw.slice(0, match.index).trim();
  return { content, sourceIds: Array.from(new Set(ids)) };
}

/**
 * Streams an assistant reply from the /api/chat server route, which calls
 * Lovable AI Gateway with the patient's records as system context.
 */
export async function streamAnswer(
  query: string,
  patientId: string,
  contextRecordId: string | null | undefined,
  history: { role: "user" | "assistant"; content: string }[],
  onToken: (chunk: string) => void,
  onDone: (msg: ChatResponse) => void,
  onError: (err: Error) => void,
  signal?: AbortSignal,
) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, patientId, contextRecordId: contextRecordId ?? null, history }),
      signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Hekma is busy — please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in your workspace.");
      throw new Error(text || `Request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let visibleEnd = 0; // index up to which we've streamed visible tokens

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) return;
      raw += decoder.decode(value, { stream: true });

      // Don't stream past a potential "SOURCES:" marker once detected.
      const sourcesIdx = raw.search(/\n?\s*SOURCES:/i);
      const safeEnd = sourcesIdx >= 0 ? sourcesIdx : raw.length - 10; // hold back last 10 chars in case marker is mid-arrival
      const target = Math.max(visibleEnd, Math.min(raw.length, safeEnd));
      if (target > visibleEnd) {
        onToken(raw.slice(visibleEnd, target));
        visibleEnd = target;
      }
    }

    const { content, sourceIds } = extractSources(raw);
    // Flush any remaining visible content (in case we held back the tail).
    if (content.length > visibleEnd) {
      onToken(content.slice(visibleEnd));
    }
    onDone({ content, sourceIds });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError(err as Error);
  }
}

