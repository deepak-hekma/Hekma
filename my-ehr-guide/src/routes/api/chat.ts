import { createFileRoute } from "@tanstack/react-router";
import { records, patient, getRecordById } from "@/lib/mockFhir";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: { query?: string; contextRecordId?: string | null; history?: { role: "user" | "assistant"; content: string }[] };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const query = (body.query ?? "").toString().trim();
        if (!query) return new Response("Empty query", { status: 400 });

        const contextRecord = body.contextRecordId ? getRecordById(body.contextRecordId) : null;

        const recordsSerialized = records
          .map((r) => {
            const fields = r.fields.map((f) => `    - ${f.label}: ${f.value}`).join("\n");
            return [
              `- id: ${r.id}`,
              `  type: ${r.resourceType}`,
              `  title: ${r.title}`,
              `  date: ${r.date}`,
              r.subtitle ? `  summary: ${r.subtitle}` : null,
              r.status ? `  status: ${r.status}` : null,
              r.provider ? `  provider: ${r.provider}` : null,
              fields ? `  fields:\n${fields}` : null,
              r.notes ? `  notes: ${r.notes}` : null,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n");

        const system = `You are Hekma, a warm and approachable health assistant for ${patient.name} (age ${patient.age}, ${patient.pronouns}). You help the patient understand their own medical records.

RULES:
- Only use information from the records below. Never invent values, dates, providers, or diagnoses.
- If the question can't be answered from the records, say so plainly and suggest related things you CAN answer.
- Be warm, plain-language, and concise. Use short paragraphs and bullet lists.
- End every substantive medical reply with: _Educational summary based on your records, not medical advice._
- When you reference a record, append a line at the very end of your message in this exact format (no other text after it):
  SOURCES: id1, id2
  Use the record ids exactly as given. Omit the SOURCES line if no records were used.

PATIENT RECORDS:
${recordsSerialized}
${contextRecord ? `\nTHE USER IS ASKING SPECIFICALLY ABOUT THIS RECORD (id: ${contextRecord.id}, "${contextRecord.title}"). Focus your answer on it.` : ""}`;

        const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [
              { role: "system", content: system },
              ...history.map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: query },
            ],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 500;
          return new Response(text || "Upstream error", { status });
        }

        // Transform OpenAI-style SSE into a plain text stream of token deltas.
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.body!.getReader();
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (data === "[DONE]") continue;
                  try {
                    const json = JSON.parse(data);
                    const delta = json?.choices?.[0]?.delta?.content;
                    if (typeof delta === "string" && delta) {
                      controller.enqueue(encoder.encode(delta));
                    }
                  } catch {
                    /* ignore non-JSON keepalives */
                  }
                }
              }
            } catch (err) {
              controller.error(err);
              return;
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
