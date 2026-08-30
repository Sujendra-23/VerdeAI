import type { ChatMessage } from "@verdeai/shared-types";
import { create } from "zustand";

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
  getMessages: (key) => get().messagesByKey[key] ?? [],
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
