import type { ChatMessage } from "@verdeai/shared-types";
import { create } from "zustand";

/**
 * Returned for threads with no messages yet. It must be the same array every time:
 * `useChatStore((s) => s.getMessages(key))` is a selector, and a fresh `[]` per call
 * makes React see a changing snapshot and re-render forever.
 */
const NO_MESSAGES: ChatMessage[] = [];

interface ChatState {
  /** Chat history keyed by `${restaurantId}:${date}` so each context keeps its own thread. */
  messagesByKey: Record<string, ChatMessage[]>;
  isSending: boolean;
  getMessages: (key: string) => ChatMessage[];
  addMessage: (key: string, message: ChatMessage) => void;
  reset: (key: string) => void;
  setSending: (sending: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByKey: {},
  isSending: false,
  getMessages: (key) => get().messagesByKey[key] ?? NO_MESSAGES,
  addMessage: (key, message) =>
    set((state) => ({
      messagesByKey: {
        ...state.messagesByKey,
        [key]: [...(state.messagesByKey[key] ?? []), message],
      },
    })),
  reset: (key) =>
    set((state) => ({
      messagesByKey: { ...state.messagesByKey, [key]: [] },
    })),
  setSending: (isSending) => set({ isSending }),
}));
