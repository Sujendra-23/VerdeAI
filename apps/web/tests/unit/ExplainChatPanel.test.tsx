import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExplainChatPanel } from "../../src/components/ExplainChatPanel";
import { useChatStore } from "../../src/store/chatStore";
import { useUiStore } from "../../src/store/uiStore";

const INSIGHT = {
  restaurant: { restaurantId: "R001", name: "Verde Kitchen", location: "Seattle, WA" },
  date: "2026-02-05",
  forecasts: [],
  wasteRisk: [],
  explanation: "Grilled Chicken Bowl is trending 43% above average.",
};

const REPLIES: Record<string, string> = {
  es: "Resumen en español: reduce la preparación de Grilled Chicken Bowl.",
  ja: "日本語の概要：Grilled Chicken Bowl の仕込みを減らしてください。",
  en: "Reducing prep by 15% should keep you ahead of the surplus.",
};

let chatBodies: Array<{ language?: string; messages: Array<{ role: string; content: string }> }>;

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExplainChatPanel />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // jsdom doesn't implement element scrolling; the panel auto-scrolls on new messages.
  Element.prototype.scrollTo = vi.fn();
  chatBodies = [];
  useChatStore.setState({ messagesByKey: {}, isSending: false });
  useUiStore.setState({
    restaurantId: "R001",
    date: "2026-02-05",
    activeTab: "explain",
    language: "auto",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/graphql")) {
        return { ok: true, json: async () => ({ data: { insight: INSIGHT } }) };
      }
      const body = JSON.parse(String(init?.body));
      chatBodies.push(body);
      const code = body.language === "auto" ? "en" : body.language;
      return {
        ok: true,
        json: async () => ({
          reply: { role: "assistant", content: REPLIES[code] ?? REPLIES.en },
          source: "template",
          language: code,
        }),
      };
    }),
  );
});

describe("ExplainChatPanel language", () => {
  it("offers Auto-detect plus every supported language", async () => {
    renderPanel();
    const select = await screen.findByLabelText(/reply language/i);
    const labels = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
    expect(labels).toEqual([
      "Auto-detect",
      "English",
      "Español",
      "Français",
      "Deutsch",
      "Português",
      "Italiano",
      "हिन्दी",
      "中文",
      "日本語",
    ]);
  });

  it("sends `auto` by default so the API follows the language typed", async () => {
    renderPanel();
    await screen.findByText(INSIGHT.explanation);
    await userEvent.type(screen.getByRole("textbox"), "¿Qué pasa hoy?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(REPLIES.en!);
    expect(chatBodies[0]!.language).toBe("auto");
    expect(chatBodies[0]!.messages.at(-1)!.content).toBe("¿Qué pasa hoy?");
  });

  it("switching language adds an overview in that language and localizes the panel", async () => {
    renderPanel();
    await screen.findByText(INSIGHT.explanation);

    await userEvent.selectOptions(screen.getByLabelText(/reply language/i), "es");

    await screen.findByText(REPLIES.es!);
    expect(chatBodies).toHaveLength(1);
    expect(chatBodies[0]).toMatchObject({ language: "es", messages: [] });
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Pregunta por un plato/)).toBeInTheDocument();
    expect(screen.getByLabelText(/idioma de respuesta/i)).toBeInTheDocument();
  });

  it("sends the selected language with each question", async () => {
    renderPanel();
    await screen.findByText(INSIGHT.explanation);
    await userEvent.selectOptions(screen.getByLabelText(/reply language/i), "ja");
    await screen.findByText(REPLIES.ja!);

    await userEvent.type(screen.getByRole("textbox"), "Grilled Chicken Bowl");
    await userEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => expect(chatBodies).toHaveLength(2));
    expect(chatBodies[1]!.language).toBe("ja");
  });

  it("opens straight into the selected language when it was chosen before the chat loaded", async () => {
    useUiStore.setState({ language: "es" });
    renderPanel();
    await screen.findByText(REPLIES.es!);
    expect(screen.queryByText(INSIGHT.explanation)).not.toBeInTheDocument();
    expect(chatBodies).toHaveLength(1);
  });

  it("choosing Auto-detect afterwards does not request another overview", async () => {
    renderPanel();
    await screen.findByText(INSIGHT.explanation);
    await userEvent.selectOptions(screen.getByLabelText(/reply language/i), "es");
    await screen.findByText(REPLIES.es!);
    await userEvent.selectOptions(screen.getByLabelText(/idioma de respuesta/i), "auto");
    expect(chatBodies).toHaveLength(1);
  });
});
