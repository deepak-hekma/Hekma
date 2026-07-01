import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import logoUrl from "@/assets/hekma-logo.png";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Plus, X, FileText, ArrowRight, Sparkles } from "lucide-react";
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

    return merged.slice(0, 3); // MessageBubble is now defined above to support layout order cleanly
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
      className="flex h-full w-full flex-col bg-white"
      aria-label="Chat with Hekma"
    >
      {/* Custom Bento Chat Header */}
      <header className="p-5 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full gradient-bg p-[1.5px]">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                <Sparkles className="text-brand-500 text-lg size-5 fill-brand-500 animate-pulse" />
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-ping-once"></div>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm leading-none">Ask Hekma</h3>
            <p className="text-[9px] text-slate-400 mt-1 font-bold uppercase tracking-wide">AI Health Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 rounded-full px-3 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold"
            onClick={newConversation}
            disabled={messages.length === 0 && !streamingText}
          >
            <Plus className="size-3.5" />
            New
          </Button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer focus:outline-none"
              aria-label="Close chat"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto custom-scroll p-5 space-y-4 bg-[#fafbfc]"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && !pending && (
          <div className="space-y-4 py-2">
            <div className="flex gap-3 max-w-[90%]">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <Sparkles className="size-4 fill-brand-600" />
              </div>
              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-sm shadow-soft text-sm text-slate-700 leading-relaxed font-medium">
                Hi Sarah! I'm Hekma. I can help analyze Abdul's records, explain his lab results, or summarize his medication schedule. How can I assist you today?
              </div>
            </div>

            {/* Suggestions list */}
            <div className="pl-11 space-y-2 mt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Suggested Actions</p>
              {chatWelcomeSuggestions.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => submit(s.text, s.recordId)}
                  className="w-full text-left bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50 p-3 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-soft flex justify-between items-center group cursor-pointer"
                >
                  <span className="truncate pr-2">{s.text}</span>
                  <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-brand-500 flex-shrink-0" />
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
            <div className="flex gap-3 max-w-[90%] animate-fade-up">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <Sparkles className="size-4 fill-brand-600 text-brand-600" />
              </div>
              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-sm shadow-soft text-sm text-slate-700 leading-relaxed font-medium w-full">
                {streamingText ? (
                  <div className="prose prose-sm max-w-none text-slate-700 prose-strong:text-slate-900 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                    <ReactMarkdown>{streamingText}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="shimmer-text text-sm font-semibold">Thinking…</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input composer styled exactly like the template */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        {contextRecord && (
          <div className="mb-3 flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 py-1 pl-3 pr-1.5 text-xs text-brand-700 font-semibold animate-fade-in">
            <FileText className="size-3.5 text-brand-500" />
            <span className="truncate">About: {contextRecord.title}</span>
            <button
              type="button"
              onClick={() => setContextRecordId(null)}
              className="ml-auto grid size-5 place-items-center rounded-full hover:bg-brand-100"
              aria-label="Remove record context"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
        <div className="relative flex items-center">
          <input
            type="text"
            ref={textareaRef as any}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Ask anything..."
            className="w-full bg-slate-50 border border-slate-200 rounded-full py-3.5 pl-4 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all font-medium"
            disabled={pending}
          />
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || pending}
            className={cn(
              "absolute right-1.5 w-10 h-10 gradient-bg text-white rounded-full flex items-center justify-center hover:shadow-md transition-all cursor-pointer focus:outline-none",
              (!input.trim() || pending) && "opacity-50 pointer-events-none"
            )}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <p className="text-[9px] text-center text-slate-400 mt-3 px-2 font-medium">
          Hekma uses AI to analyze records. Always verify clinical decisions.
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
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-100 px-2 py-0.5 text-[10px] text-brand-700 font-semibold">
                <FileText className="size-2.5" />
                {getRecordById(message.sourceIds[0])?.title ?? "record"}
              </span>
            </div>
          )}
          <div className="rounded-2xl rounded-br-md bg-gradient-to-tr from-brand-500 to-indigo-600 px-4 py-2.5 text-sm text-white font-medium shadow-md">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-[90%] animate-fade-up">
      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
        <Sparkles className="size-4 fill-brand-600 text-brand-600" />
      </div>
      <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-sm shadow-soft text-sm text-slate-700 leading-relaxed font-medium">
        <div className="prose prose-sm max-w-none text-slate-700 prose-strong:text-slate-900 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.sourceIds && message.sourceIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-slate-50">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Sources</span>
            {message.sourceIds.map((id) => {
              const r = getRecordById(id);
              if (!r) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSourceClick(id)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 px-2.5 py-0.5 text-[10px] text-slate-600 transition-colors font-medium cursor-pointer"
                >
                  <FileText className="size-2.5 text-brand-500" />
                  {r.title}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
