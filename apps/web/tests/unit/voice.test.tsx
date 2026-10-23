import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplainChatPanel } from "../../src/components/ExplainChatPanel";
import { Sidebar } from "../../src/components/Sidebar";
import { useLanguageStore } from "../../src/i18n";
import { useChatStore } from "../../src/store/chatStore";
import { useUiStore } from "../../src/store/uiStore";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = true;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.started = true; }
  stop() { this.started = false; this.onend?.(); }
  abort() { this.started = false; }
  say(text: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] });
    this.stop();
  }
  hear(text: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: text } }] });
  }
}
const lastRecognition = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]!;

const INSIGHT = {
  restaurant: { restaurantId: "R001", name: "Verde Kitchen", location: "Seattle, WA" },
  date: "2026-02-05",
  forecasts: [],
  wasteRisk: [],
  explanation: "Grilled Chicken Bowl is trending 43% above average.",
};
let chatBodies: Array<{ language?: string; messages: Array<{ role: string; content: string }> }>;
const spoken: Array<{ text: string; lang: string }> = [];

function renderWith(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  FakeRecognition.instances = [];
  spoken.length = 0;
  chatBodies = [];
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} lang = ""; voice: unknown = null; });
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      getVoices: () => [],
      cancel: vi.fn(),
      speak: (u: { text: string; lang: string }) => spoken.push({ text: u.text, lang: u.lang }),
    },
  });
  useChatStore.setState({ messagesByKey: {}, isSending: false });
  useUiStore.setState({ restaurantId: "R001", date: "2026-02-05", activeTab: "forecast", language: "auto", readAloud: false });
  useLanguageStore.getState().setLocale("en");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/graphql")) return { ok: true, json: async () => ({ data: { insight: INSIGHT, restaurants: [] } }) };
    if (url.endsWith("/api/restaurants")) return { ok: true, json: async () => [] };
    if (url.includes("/api/experiments/events")) return { ok: true, json: async () => ({}) };
    chatBodies.push(JSON.parse(String(init?.body)));
    return { ok: true, json: async () => ({ reply: { role: "assistant", content: "Prep 15% less." }, source: "template", language: "en" }) };
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // @ts-expect-error cleaning up the stub installed in beforeEach
  delete window.speechSynthesis;
});

describe("spoken navigation", () => {
  it("listens in the interface language and opens the tab that was spoken", async () => {
    useLanguageStore.getState().setLocale("es");
    renderWith(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Hablar" }));
    expect(lastRecognition().lang).toBe("es-ES");
    expect(lastRecognition().started).toBe(true);
    act(() => lastRecognition().say("muestra el riesgo de desperdicio"));
    await waitFor(() => expect(useUiStore.getState().activeTab).toBe("waste-risk"));
  });

  it("shows what it heard while listening and says so when the phrase is not a command", async () => {
    renderWith(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(screen.getByRole("button", { name: "Stop listening" })).toHaveAttribute("aria-pressed", "true");
    act(() => lastRecognition().hear("open the wa"));
    expect(screen.getByText("open the wa")).toBeInTheDocument();
    act(() => lastRecognition().say("what is the weather"));
    expect(await screen.findByText("Sorry, I didn't catch that.")).toBeInTheDocument();
    expect(useUiStore.getState().activeTab).toBe("forecast");
  });

  it("reports a blocked microphone", async () => {
    renderWith(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    act(() => { lastRecognition().onerror?.({ error: "not-allowed" }); lastRecognition().stop(); });
    expect(await screen.findByText("Microphone access was blocked.")).toBeInTheDocument();
  });

  it("hides the microphone where the browser has no speech recognition", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    renderWith(<Sidebar />);
    expect(screen.queryByRole("button", { name: "Speak" })).not.toBeInTheDocument();
  });
});

describe("speaking to the assistant", () => {
  it("sends a dictated question in the chosen language and reads the reply aloud", async () => {
    useUiStore.setState({ activeTab: "explain", language: "ja" });
    renderWith(<ExplainChatPanel />);
    await waitFor(() => expect(chatBodies.length).toBeGreaterThan(0));
    const readAloudToggle = await screen.findByRole("button", { name: "返信を読み上げる" });
    expect(readAloudToggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(readAloudToggle);
    expect(readAloudToggle).toHaveAttribute("aria-pressed", "true");
    spoken.length = 0;
    await userEvent.click(screen.getByRole("button", { name: "話す" }));
    expect(lastRecognition().lang).toBe("ja-JP");
    act(() => lastRecognition().say("サーモンはどうですか"));
    await waitFor(() => expect(chatBodies.some((b) => b.messages.at(-1)?.content === "サーモンはどうですか")).toBe(true));
    await waitFor(() => expect(spoken.some((s) => s.text === "Prep 15% less." && s.lang === "ja-JP")).toBe(true));
  });

  it("does not read replies aloud until the option is switched on", async () => {
    useUiStore.setState({ activeTab: "explain" });
    renderWith(<ExplainChatPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Speak" }));
    act(() => lastRecognition().say("What about the salmon?"));
    await waitFor(() => expect(chatBodies).toHaveLength(1));
    await screen.findByText("Prep 15% less.");
    expect(spoken).toHaveLength(0);
  });

  it("treats a navigation phrase as a command instead of a question", async () => {
    useUiStore.setState({ activeTab: "explain" });
    renderWith(<ExplainChatPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Speak" }));
    act(() => lastRecognition().say("forecast"));
    await waitFor(() => expect(useUiStore.getState().activeTab).toBe("forecast"));
    expect(chatBodies).toHaveLength(0);
  });
});
