import { SUPPORTED_LANGUAGES, isLanguagePreference } from "@verdeai/shared-types";
import { panelStrings } from "../chatI18n";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useInsight } from "../hooks/useInsight";
import { useExplainChat } from "../hooks/useExplainChat";
import { useChatStore } from "../store/chatStore";
import { useUiStore } from "../store/uiStore";
import { speak, speechOutputSupported, stopSpeaking } from "../speech/synthesis";
import { useRunVoiceCommand, useVoiceLang } from "../speech/useVoiceCommands";
import { voiceStrings } from "../speech/voiceStrings";
import { VoiceButton } from "./VoiceButton";

import { useI18n } from "../i18n";

export function ExplainChatPanel() {
  const { locale, t } = useI18n();
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const chatKey = `${restaurantId}:${date}:${locale}`;

  const { data: insight, isLoading: insightLoading, isError: insightError, refetch } = useInsight(restaurantId, date);
  const addMessage = useChatStore((s) => s.addMessage);
  const { messages, sendMessage, requestExplanation, isSending, error } = useExplainChat(restaurantId, date);

  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const panel = panelStrings(language);
  const chatText = { explain: panel.title, loadingInsight: panel.loading, thinking: panel.thinking, placeholder: panel.placeholder, send: panel.send };
  const ui = (key: keyof typeof chatText) => language === "auto" && locale !== "en" ? t(key) : chatText[key];
  const readAloud = useUiStore((s) => s.readAloud);
  const setReadAloud = useUiStore((s) => s.setReadAloud);
  const voiceLang = useVoiceLang();
  const runVoiceCommand = useRunVoiceCommand(voiceLang);
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
      if (language === "auto" || language === "en") addMessage(chatKey, { role: "assistant", content: insight.explanation });
      else requestExplanation(language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insight, chatKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const previousLanguageRef = useRef(language);
  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    previousLanguageRef.current = language;
    if (language !== "auto" && messages.length > 0) requestExplanation(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Speak only replies that arrive after this point, so switching the option on never replays the thread.
  const spokenCountRef = useRef(messages.length);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (readAloud && messages.length > spokenCountRef.current && last?.role === "assistant") speak(last.content, voiceLang);
    spokenCountRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);
  useEffect(() => { if (!readAloud) stopSpeaking(); }, [readAloud]);
  useEffect(() => stopSpeaking, []);

  // A spoken phrase is either a navigation command or a question for the assistant.
  function handleVoice(text: string): boolean {
    if (runVoiceCommand(text)) return true;
    if (!isSending) sendMessage(text);
    return true;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = draft.trim();
    if (!question || isSending) return;
    sendMessage(question);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col md:min-h-64">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{ui("explain")}</h2>
        <label className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-slate-300">
          {panel.languageLabel}
          <select className="min-h-11 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-100" value={language} onChange={(event) => { if (isLanguagePreference(event.target.value)) setLanguage(event.target.value); }}>
            <option value="auto">{panel.auto}</option>
            {SUPPORTED_LANGUAGES.map(value => <option key={value.code} value={value.code}>{value.nativeName}</option>)}
          </select>
        </label>
      </div>

      <div
        ref={scrollRef}
        className="mb-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-4"
      >
        {insightLoading && messages.length === 0 && (
          <p className="text-sm text-slate-400">{ui("loadingInsight")}</p>
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
              {ui("thinking")}
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
          placeholder={ui("placeholder")}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base focus:border-verde-500 focus:outline-none"
          disabled={isSending}
        />
        {speechOutputSupported() && (
          <button
            type="button"
            aria-pressed={readAloud}
            aria-label={voiceStrings(voiceLang).readAloud}
            title={voiceStrings(voiceLang).readAloud}
            onClick={() => setReadAloud(!readAloud)}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm ${readAloud ? "border-verde-500 bg-verde-600/20 text-verde-400" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}
          >
            <span aria-hidden="true">{readAloud ? "🔊" : "🔇"}</span>
          </button>
        )}
        <VoiceButton lang={voiceLang} onTranscript={handleVoice} />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="min-h-11 rounded-md bg-verde-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-verde-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ui("send")}
        </button>
      </form>
    </div>
  );
}
