import type { ChatMessage, LanguagePreference } from "@verdeai/shared-types";
import { useMutation } from "@tanstack/react-query";
import { postExplainChat } from "../api/client";
import { useChatStore } from "../store/chatStore";

import { useUiStore } from "../store/uiStore";
import { useLanguageStore } from "../i18n";

/**
 * Sends one chat turn to POST /api/explain/chat, appending both the user's
 * question and the assistant's reply to the shared chatStore keyed by
 * restaurant/date. Only one send is allowed in flight at a time (enforced by
 * disabling the input while isSending), so the closed-over `messages` used to
 * build the request body is always current when mutationFn actually runs.
 */
export function useExplainChat(restaurantId: string, date: string) {
  const locale = useLanguageStore((s) => s.locale);
  const language = useUiStore((s) => s.language);
  const key = `${restaurantId}:${date}:${locale}`;
  const addMessage = useChatStore((s) => s.addMessage);
  const setSending = useChatStore((s) => s.setSending);
  const messages = useChatStore((s) => s.getMessages(key));

  const mutation = useMutation({
    mutationKey: ["explain", key],
    mutationFn: async (question: string) => {
      const userMessage: ChatMessage = { role: "user", content: question };
      addMessage(key, userMessage);
      setSending(true);
      try {
        const result = await postExplainChat(restaurantId, date, [...messages, userMessage], language === "auto" && locale !== "en" ? locale : undefined, language === "auto" && locale !== "en" ? undefined : language);
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
        const result = await postExplainChat(restaurantId, date, [], undefined, target);
        addMessage(key, result.reply);
        return result;
      } finally { setSending(false); }
    },
  });
  return { messages, sendMessage: mutation.mutate, requestExplanation: explain.mutate,
    isSending: mutation.isPending || explain.isPending, error: mutation.error ?? explain.error };
}
