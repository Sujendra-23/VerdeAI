import type { ChatMessage, LanguagePreference } from "@verdeai/shared-types";
import { useMutation } from "@tanstack/react-query";
import { postExplainChat } from "../api/client";
import { useChatStore } from "../store/chatStore";
import { useUiStore } from "../store/uiStore";

/**
 * Sends one chat turn to POST /api/explain/chat, appending both the user's
 * question and the assistant's reply to the shared chatStore keyed by
 * restaurant/date. Only one send is allowed in flight at a time (enforced by
 * disabling the input while isSending), so the closed-over `messages` used to
 * build the request body is always current when mutationFn actually runs.
 *
 * Every request carries the language chosen in the UI (`auto` lets the API
 * answer in the language the manager wrote in). `requestExplanation` asks for
 * a fresh overview in a given language, used when the manager switches language
 * mid-conversation.
 */
export function useExplainChat(restaurantId: string, date: string) {
  const key = `${restaurantId}:${date}`;
  const language = useUiStore((s) => s.language);
  const addMessage = useChatStore((s) => s.addMessage);
  const setSending = useChatStore((s) => s.setSending);
  const messages = useChatStore((s) => s.getMessages(key));

  const send = useMutation({
    mutationFn: async (question: string) => {
      const userMessage: ChatMessage = { role: "user", content: question };
      addMessage(key, userMessage);
      setSending(true);
      try {
        const result = await postExplainChat(
          restaurantId,
          date,
          [...messages, userMessage],
          language,
        );
        addMessage(key, result.reply);
        return result;
      } finally {
        setSending(false);
      }
    },
  });

  const explain = useMutation({
    mutationFn: async (target: LanguagePreference) => {
      setSending(true);
      try {
        const result = await postExplainChat(restaurantId, date, [], target);
        addMessage(key, result.reply);
        return result;
      } finally {
        setSending(false);
      }
    },
  });

  return {
    messages,
    sendMessage: send.mutate,
    requestExplanation: explain.mutate,
    isSending: send.isPending || explain.isPending,
  };
}
