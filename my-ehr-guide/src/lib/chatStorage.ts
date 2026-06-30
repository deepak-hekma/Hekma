import type { ChatMessage } from "./chatbot";

const getStorageKey = (patientId?: string) => {
  const safeId = patientId ? patientId.replace(/[^a-zA-Z0-9-_]/g, "") : "general";
  return `hekma.chat.${safeId}.v1`;
};

export function loadChat(patientId?: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getStorageKey(patientId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveChat(messages: ChatMessage[], patientId?: string) {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(patientId);
    window.localStorage.setItem(key, JSON.stringify(messages));
  } catch {
    /* ignore quota */
  }
}

export function clearChat(patientId?: string) {
  if (typeof window === "undefined") return;
  const key = getStorageKey(patientId);
  window.localStorage.removeItem(key);
}
