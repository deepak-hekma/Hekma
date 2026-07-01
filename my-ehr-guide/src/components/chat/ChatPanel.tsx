import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import logoUrl from "@/assets/hekma-logo.png";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Plus, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ChatMessage, streamAnswer } from "@/lib/chatbot";
import { loadChat, saveChat, clearChat } from "@/lib/chatStorage";
import type { FhirRecord } from "@/lib/mockFhir";

export interface ChatPanelHandle {
  focusComposer: () => void;
  prefill: (text: string) => void;
  attachRecord: (r: FhirRecord) => void;
}

interface Props {
  patientId: string;
  records: FhirRecord[];
  onSourceClick: (recordId: string) => void;
  onClose?: () => void;
  pendingQuestion?: string | null;
  pendingRecord?: FhirRecord | null;
  onClearPendingQuestion?: () => void;
  onClearPendingRecord?: () => void;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const ChatPanel = forwardRef<ChatPanelHandle, Props>(function ChatPanel(
  { 
    patientId, 
    records, 
    onSourceClick, 
    onClose,
    pendingQuestion,
    pendingRecord,
    onClearPendingQuestion,
    onClearPendingRecord
  },
  ref,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [contextRecordId, setContextRecordId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydrated = useRef(false);

  // Handle external pending record attachment
  useEffect(() => {
    if (pendingRecord) {
      setContextRecordId(pendingRecord.id);
      onClearPendingRecord?.();
    }
  }, [pendingRecord, onClearPendingRecord]);

  // Handle external pending question auto-submission
  useEffect(() => {
    if (pendingQuestion) {
      setInput(pendingQuestion);
      submit(pendingQuestion);
      onClearPendingQuestion?.();
    }
  }, [pendingQuestion, onClearPendingQuestion]);

  // Load patient-specific chat (handles both initial hydration and patient changes)
  useEffect(() => {
    setMessages(loadChat(patientId));
    if (!hydrated.current) {
      hydrated.current = true;
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [patientId]);

  // Autoscroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText, pending]);

  useImperativeHandle(ref, () => ({
    focusComposer: () => textareaRef.current?.focus(),
    prefill: (t: string) => {
      setInput(t);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    attachRecord: (r: FhirRecord) => {
      setContextRecordId(r.id);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
  }));

  // Global ⌘K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  interface ChatSuggestion {
    text: string;
    recordId: string | null;
  }

  const chatWelcomeSuggestions = useMemo<ChatSuggestion[]>(() => {
    const list: ChatSuggestion[] = [];

    const isVitalTitle = (title: string) => {
      const t = title.toLowerCase();
      return t.includes("blood pressure") || t.includes("heart rate") || 
             t.includes("temperature") || t.includes("respiratory rate") || 
             t.includes("weight") || t.includes("height") || 
             t.includes("body mass index") || t.includes("steps");
    };

    const isExcludedObservation = (title: string) => {
      const t = title.toLowerCase();
      return t.includes("cause of death") || t.includes("death certificate") || t.includes("certification of death");
    };

    // Always start with general summary
    list.push({ text: "Summarize my health records", recordId: null });

    // 1. Find conditions
    const activeConditions = records.filter((r) => r.resourceType === "Condition" && r.status === "active");
    const anyConditions = activeConditions.length > 0 ? activeConditions : records.filter((r) => r.resourceType === "Condition");
    if (anyConditions.length > 0) {
      const condRecord = anyConditions[0];
      const condName = condRecord.title.replace(/\s*\([^)]*\)/g, "").trim();
      list.push({ text: `What is ${condName}?`, recordId: condRecord.id });
    }

    // 2. Find medications
    const meds = records.filter(
      (r) => r.resourceType === "MedicationStatement" || r.resourceType === "MedicationRequest"
    );
    if (meds.length > 0) {
      const medRecord = meds[0];
      const medName = medRecord.title.split(" ")[0].replace(/[,;]/g, "");
      list.push({ text: `Are there side effects of ${medName}?`, recordId: medRecord.id });
    }

    // 3. Find recent lab observations (excluding vitals and death records)
    const labsList = records.filter(
      (r) => r.resourceType === "Observation" && !isVitalTitle(r.title) && !isExcludedObservation(r.title)
    );
    if (labsList.length > 0) {
      const labRecord = labsList[0];
      const obsName = labRecord.title.toLowerCase();
      list.push({ text: `Explain my last ${obsName} test`, recordId: labRecord.id });
    }

    // Fallbacks
    const fallbacks: ChatSuggestion[] = [
      { text: "What diagnoses are on my profile?", recordId: null },
      { text: "Explain my latest lab reports", recordId: null },
      { text: "What medications am I taking?", recordId: null },
    ];

    // Deduplicate items by text
    const seen = new Set<string>();
    const merged: ChatSuggestion[] = [];
    for (const item of [...list, ...fallbacks]) {
      if (!seen.has(item.text)) {
        seen.add(item.text);
        merged.push(item);
      }
    }

    return merged.slice(0, 3); // Keep top 3 suggestions for layout consistency
  }, [records]);

  const getRecordById = (id: string) => records.find((r) => r.id === id);

  const contextRecord = useMemo(
    () => (contextRecordId ? getRecordById(contextRecordId) : null),
    [contextRecordId, records],
  );

  const submit = async (text: string, forceRecordId?: string | null) => {
    const t = text.trim();
    if (!t || pending) return;

    const ctx = forceRecordId !== undefined ? forceRecordId : contextRecordId;
    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      content: t,
      createdAt: Date.now(),
      sourceIds: ctx ? [ctx] : undefined,
    };
    const priorHistory = messages.map((m) => ({ role: m.role, content: m.content }));
    
    // Explicitly update and save the user message immediately
    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    saveChat(updatedWithUser, patientId);

    setInput("");
    setContextRecordId(null);
    setPending(true);
    setStreamingText("");

    const controller = new AbortController();
    abortRef.current = controller;
    let buf = "";

    await streamAnswer(
      t,
      patientId,
      ctx,
      priorHistory,
      (chunk: string) => {
        buf += chunk;
        setStreamingText(buf);
      },
      (final) => {
        setMessages((m) => {
          const updated = [
            ...m,
            {
              id: newId(),
              role: "assistant",
              content: final.content,
              sourceIds: final.sourceIds,
              createdAt: Date.now(),
            },
          ];
          saveChat(updated, patientId);
          return updated;
        });
        setStreamingText("");
        setPending(false);
        requestAnimationFrame(() => textareaRef.current?.focus());
      },
      (err: Error) => {
        setMessages((m) => {
          const updated = [
            ...m,
            {
              id: newId(),
              role: "assistant",
              content: `Sorry — I couldn't reach my reasoning service. ${err.message}`,
              createdAt: Date.now(),
            },
          ];
          saveChat(updated, patientId);
          return updated;
        });
        setStreamingText("");
        setPending(false);
      },
      controller.signal,
    );
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
    if (e.key === "Escape" && contextRecordId) {
      e.preventDefault();
      setContextRecordId(null);
    }
  };

  const newConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamingText("");
    setPending(false);
    setContextRecordId(null);
    clearChat(patientId);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <section
      className="flex h-full w-full flex-col border-l border-border bg-background"
      aria-label="Chat with Hekma"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="" width={22} height={22} className="size-5" />
          <div>
            <div className="text-sm font-medium leading-none text-ink">Hekma</div>
            <div className="text-[10px] leading-tight text-muted-foreground">
              {pending ? "Reading your records…" : "Ready"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={newConversation}
            disabled={messages.length === 0 && !streamingText}
          >
            <Plus className="size-3.5" />
            New
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg text-ink/75 hover:bg-ink/5"
              onClick={onClose}
              aria-label="Close chat"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && !pending && (
          <div className="space-y-4 py-6">
            <div className="text-sm leading-relaxed text-ink/85">
              Hi, I'm <span className="font-serif text-base">Hekma</span>. I can help answer questions
              about your health records, explain test results, and summarize your visits. I'll
              always show where the information comes from.
            </div>
            <div className="space-y-1.5">
              {chatWelcomeSuggestions.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => submit(s.text, s.recordId)}
                  className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-sage-soft cursor-pointer"
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} getRecordById={getRecordById} onSourceClick={onSourceClick} />
          ))}
          {pending && (
            <div className="animate-fade-up">
              {streamingText ? (
                <div className="prose prose-sm max-w-none text-ink/90 prose-strong:text-ink prose-p:my-2">
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                </div>
              ) : (
                <div className="shimmer-text text-sm">Thinking…</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        {contextRecord && (
          <div className="mb-2 flex items-center gap-2 rounded-full bg-sage-soft py-1 pl-2.5 pr-1 text-xs text-ink">
            <FileText className="size-3.5 text-sage" />
            <span className="truncate">About: {contextRecord.title}</span>
            <button
              type="button"
              onClick={() => setContextRecordId(null)}
              className="ml-auto grid size-5 place-items-center rounded-full hover:bg-background"
              aria-label="Remove record context"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-sage focus-within:ring-2 focus-within:ring-sage/20">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your health…"
            rows={1}
            className="min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
            aria-label="Message Hekma"
            disabled={pending}
          />
          <Button
            size="icon"
            className={cn("size-9 shrink-0 rounded-xl", !input.trim() && "opacity-50")}
            onClick={() => submit(input)}
            disabled={!input.trim() || pending}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
          Hekma reads your records to answer. Not medical advice.
        </p>
      </div>
    </section>
  );
});

function MessageBubble({
  message,
  getRecordById,
  onSourceClick,
}: {
  message: ChatMessage;
  getRecordById: (id: string) => FhirRecord | undefined;
  onSourceClick: (id: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex animate-fade-up justify-end">
        <div className="max-w-[85%] space-y-1">
          {message.sourceIds?.[0] && (
            <div className="flex justify-end">
              <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[10px] text-ink">
                <FileText className="size-2.5" />
                {getRecordById(message.sourceIds[0])?.title ?? "record"}
              </span>
            </div>
          )}
          <div className="rounded-2xl rounded-br-md bg-sage px-3.5 py-2 text-sm text-primary-foreground">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-2">
      <div className="prose prose-sm max-w-none text-ink/90 prose-strong:text-ink prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {message.sourceIds && message.sourceIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sources</span>
          {message.sourceIds.map((id) => {
            const r = getRecordById(id);
            if (!r) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSourceClick(id)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-ink hover:bg-sage-soft"
              >
                <FileText className="size-2.5 text-sage" />
                {r.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
