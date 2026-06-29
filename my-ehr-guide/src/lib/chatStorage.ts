import type { ChatMessage } from "./chatbot";

const KEY = "hekma.chat.v1";

export function loadChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveChat(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(messages));
  } catch {
    /* ignore quota */
  }
}

export function clearChat() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
