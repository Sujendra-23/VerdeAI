import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { assignVariant } from "@verdeai/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExperimentResultsPanel } from "../../src/components/ExperimentResultsPanel";
import { ForecastPanel } from "../../src/components/ForecastPanel";
import { Sidebar } from "../../src/components/Sidebar";
import { resetExposureLog } from "../../src/experiments/tracking";
import { useUiStore } from "../../src/store/uiStore";

const ID = "forecast-inline-risk";

const INSIGHT = {
  restaurant: { restaurantId: "R001", name: "Verde Kitchen", location: "Seattle, WA" },
  date: "2026-02-05",
  forecasts: [
    { id: "1", restaurantId: "R001", date: "2026-02-05", item: "Grilled Chicken Bowl", predictedQuantity: 60, historicalAverage: 42 },
    { id: "2", restaurantId: "R001", date: "2026-02-05", item: "Lentil Soup", predictedQuantity: 20, historicalAverage: 20 },
  ],
  wasteRisk: [
    { id: "1", restaurantId: "R001", date: "2026-02-05", item: "Grilled Chicken Bowl", predictedQuantity: 60, riskScore: "HIGH" },
    { id: "2", restaurantId: "R001", date: "2026-02-05", item: "Lentil Soup", predictedQuantity: 20, riskScore: "LOW" },
  ],
  explanation: "",
};

function userIn(variant: string): string {
  for (let i = 0; i < 1000; i++) if (assignVariant(ID, `u${i}`) === variant) return `u${i}`;
  throw new Error("no user");
}

let events: Array<Record<string, unknown>>;

function useUser(userId: string) {
  const values = new Map<string, string>([["verdeai.userId", userId]]);
  // Node's experimental storage shadows jsdom's storage in this runtime.
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    clear: () => values.clear(),
  });
}

function renderWith(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  events = [];
  resetExposureLog();
  useUiStore.setState({ restaurantId: "R001", date: "2026-02-05", activeTab: "forecast" });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/experiments/events")) {
      events.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 201, json: async () => ({ status: "recorded" }) };
    }
    if (url.endsWith("/graphql")) return { ok: true, json: async () => ({ data: { insight: INSIGHT } }) };
    if (url.endsWith("/api/restaurants")) return { ok: true, json: async () => [INSIGHT.restaurant] };
    if (url.includes(`/api/experiments/${ID}/results`)) {
      return { ok: true, json: async () => ({
        experimentId: ID,
        conversionEvent: "waste_risk_opened",
        variants: [
          { variant: "control", exposures: 120, conversions: 12, rate: 0.1 },
          { variant: "treatment", exposures: 118, conversions: 24, rate: 24 / 118 },
        ],
        lift: 1.03,
        zScore: 2.4,
        verdict: "significant",
      }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("forecast-inline-risk experiment", () => {
  it("control users see the plain table and log one control exposure", async () => {
    const user = userIn("control");
    useUser(user);
    renderWith(<ForecastPanel />);
    await screen.findByText("Grilled Chicken Bowl");
    expect(screen.queryAllByTestId("inline-risk-badge")).toHaveLength(0);
    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({ experimentId: ID, userId: user, variant: "control", type: "exposure" });
  });

  it("treatment users see a risk badge per item and a click opens Waste Risk and logs a conversion", async () => {
    const user = userIn("treatment");
    useUser(user);
    renderWith(<ForecastPanel />);
    await screen.findByText("Grilled Chicken Bowl");
    const badges = screen.getAllByTestId("inline-risk-badge");
    expect(badges.map((b) => b.textContent)).toEqual(["HIGH", "LOW"]);
    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({ variant: "treatment", type: "exposure" });

    await userEvent.click(badges[0]!);
    expect(useUiStore.getState().activeTab).toBe("waste-risk");
    expect(events[1]).toMatchObject({ userId: user, variant: "treatment", type: "conversion", event: "waste_risk_opened" });
  });

  it("does not log an exposure while the forecast is still loading or when it is empty", async () => {
    useUser(userIn("control"));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/experiments/events")) events.push(JSON.parse(String(init?.body)));
      return { ok: true, json: async () => ({ data: { insight: { ...INSIGHT, forecasts: [], wasteRisk: [] } } }) };
    }));
    renderWith(<ForecastPanel />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull());
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(events).toHaveLength(0);
  });

  it("opening Waste Risk from the sidebar converts a control user too", async () => {
    const user = userIn("control");
    useUser(user);
    renderWith(<Sidebar />);
    await userEvent.click(await screen.findByRole("button", { name: /waste risk/i }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ userId: user, variant: "control", type: "conversion" });
  });

  it("keeps working when the events endpoint is down", async () => {
    useUser(userIn("treatment"));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/api/experiments/events")) throw new Error("network down");
      return { ok: true, json: async () => ({ data: { insight: INSIGHT } }) };
    }));
    renderWith(<ForecastPanel />);
    expect(await screen.findByText("Grilled Chicken Bowl")).toBeInTheDocument();
    expect(screen.getAllByTestId("inline-risk-badge")).toHaveLength(2);
  });
});

describe("ExperimentResultsPanel", () => {
  it("shows per-variant counts, rates, lift and the verdict", async () => {
    renderWith(<ExperimentResultsPanel />);
    expect(await screen.findByText(`Experiment: ${ID}`)).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /control 120 12 10\.0%/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /treatment 118 24 20\.3%/ })).toBeInTheDocument();
    expect(screen.getByTestId("experiment-verdict")).toHaveTextContent("Relative lift: +103.0%. Significant difference at the 95% level.");
  });
});
