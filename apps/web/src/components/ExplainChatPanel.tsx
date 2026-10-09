import { SUPPORTED_LANGUAGES, isLanguagePreference } from "@verdeai/shared-types";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { panelStrings } from "../i18n";
import { useInsight } from "../hooks/useInsight";
import { useExplainChat } from "../hooks/useExplainChat";
import { useChatStore } from "../store/chatStore";
import { useUiStore } from "../store/uiStore";

export function ExplainChatPanel() {
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const chatKey = `${restaurantId}:${date}`;

  const { data: insight, isLoading: insightLoading } = useInsight(restaurantId, date);
  const addMessage = useChatStore((s) => s.addMessage);
  const { messages, sendMessage, requestExplanation, isSending } = useExplainChat(restaurantId, date);
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const t = panelStrings(language);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks which chatKeys have already been seeded, so the seed message is
  // added at most once per restaurant/date even though React 19 StrictMode
  // invokes effects twice in dev (a state-only `messages.length === 0` guard
  // isn't enough there: both invocations can see the same pre-update length).
  const seededKeysRef = useRef<Set<string>>(new Set());

  // Seed the thread with the AI-generated explanation the first time it loads
  // for this restaurant/date; the chat then continues from there.
  // The insight's explanation is generated in English; when another language is
  // already selected, ask the API for the overview in that language instead.
  useEffect(() => {
    if (insight && messages.length === 0 && !seededKeysRef.current.has(chatKey)) {
      seededKeysRef.current.add(chatKey);
      if (language === "auto" || language === "en") {
        addMessage(chatKey, { role: "assistant", content: insight.explanation });
      } else {
        requestExplanation(language);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insight, chatKey]);

  // Switching language mid-conversation adds a fresh overview in the new language.
  const previousLanguageRef = useRef(language);
  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    previousLanguageRef.current = language;
    if (language !== "auto" && messages.length > 0) requestExplanation(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

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
    <div
      className="flex h-full max-h-[calc(100vh-8rem)] flex-col"
      lang={language === "auto" ? undefined : language}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">{t.title}</h2>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          {t.languageLabel}
          <select
            value={language}
            onChange={(e) => {
              if (isLanguagePreference(e.target.value)) setLanguage(e.target.value);
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-verde-500 focus:outline-none"
          >
            <option value="auto">{t.auto}</option>
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={scrollRef}
        className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-4"
      >
        {insightLoading && messages.length === 0 && (
          <p className="text-sm text-slate-400">{t.loading}</p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-verde-600 text-white" : "bg-slate-800 text-slate-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400">
              {t.thinking}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.placeholder}
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-verde-500 focus:outline-none"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="rounded-md bg-verde-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-verde-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}
