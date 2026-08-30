import { type FormEvent, useEffect, useRef, useState } from "react";
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
  const { messages, sendMessage, isSending } = useExplainChat(restaurantId, date);

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
    <div className="flex h-full max-h-[calc(100vh-8rem)] flex-col">
      <h2 className="mb-4 text-base font-semibold">AI Explain</h2>

      <div
        ref={scrollRef}
        className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-4"
      >
        {insightLoading && messages.length === 0 && (
          <p className="text-sm text-slate-400">Loading today&apos;s insight…</p>
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
              VerdeAI is thinking…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about a menu item, e.g. “What about the Miso Salmon Plate?”"
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-verde-500 focus:outline-none"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="rounded-md bg-verde-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-verde-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
