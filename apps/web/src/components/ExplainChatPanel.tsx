import { type FormEvent, useEffect, useRef, useState } from "react";
import { useInsight } from "../hooks/useInsight";
import { useExplainChat } from "../hooks/useExplainChat";
import { useChatStore } from "../store/chatStore";
import { useUiStore } from "../store/uiStore";

import { useI18n } from "../i18n";

export function ExplainChatPanel() {
  const { locale, t } = useI18n();
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const chatKey = `${restaurantId}:${date}:${locale}`;

  const { data: insight, isLoading: insightLoading, isError: insightError, refetch } = useInsight(restaurantId, date);
  const addMessage = useChatStore((s) => s.addMessage);
  const { messages, sendMessage, isSending, error } = useExplainChat(restaurantId, date);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks which chatKeys have already been seeded, so the seed message is
  // added at most once per restaurant/date even though React 19 StrictMode
  // invokes effects twice in dev (a state-only `messages.length === 0` guard
  // isn't enough there: both invocations can see the same pre-update length).
  const seededKeysRef = useRef<Set<string>>(new Set());

  // Seed the thread with the AI-generated explanation the first time it loads
  // for this restaurant/date; the chat then continues from there.
  useEffect(() => {
    if (insight && messages.length === 0 && !seededKeysRef.current.has(chatKey)) {
      seededKeysRef.current.add(chatKey);
      addMessage(chatKey, { role: "assistant", content: insight.explanation });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insight, chatKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = draft.trim();
    if (!question || isSending) return;
    sendMessage(question);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col md:min-h-64">
      <h2 className="mb-4 text-base font-semibold">{t("explain")}</h2>

      <div
        ref={scrollRef}
        className="mb-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-4"
      >
        {insightLoading && messages.length === 0 && (
          <p className="text-sm text-slate-400">{t("loadingInsight")}</p>
        )}

        {insightError && messages.length === 0 && <div role="alert"><p className="text-sm text-red-400">{t("loadError")}</p><button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 rounded-md border border-slate-700 px-4 text-sm">{t("retry")}</button></div>}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] break-words rounded-lg px-3 py-2 text-sm md:max-w-[80%] ${
                m.role === "user" ? "bg-verde-700 text-white" : "bg-slate-800 text-slate-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400">
              {t("thinking")}
            </div>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mb-2 text-sm text-red-400">{t("sendError")}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          aria-label={t("ask")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("placeholder")}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-verde-500 focus:outline-none"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="min-h-11 rounded-md bg-verde-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-verde-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("send")}
        </button>
      </form>
    </div>
  );
}
