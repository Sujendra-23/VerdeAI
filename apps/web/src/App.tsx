import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppStatus } from "./components/AppStatus";
import { ExperimentResultsPanel } from "./components/ExperimentResultsPanel";
import { ExplainChatPanel } from "./components/ExplainChatPanel";
import { ForecastPanel } from "./components/ForecastPanel";
import { Sidebar } from "./components/Sidebar";
import { WasteRiskPanel } from "./components/WasteRiskPanel";
import { useHealth } from "./hooks/useHealth";
import { useUiStore } from "./store/uiStore";

import { useI18n } from "./i18n";
import { LanguageSelector } from "./components/LanguageSelector";

const queryClient = new QueryClient();

function DataSourceBadge() {
  const { t } = useI18n();
  const { data } = useHealth();
  if (!data) return null;

  const isMock = data.dataSource === "mock";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        isMock ? "bg-amber-400/10 text-amber-300" : "bg-verde-500/10 text-verde-400"
      }`}
      title={
        isMock
          ? t("demoHint")
          : t("liveHint")
      }
    >
      {isMock ? t("demo") : t("live")}
    </span>
  );
}

const EXPERIMENTS_HASH = "#/experiments";

function useExperimentsView() {
  const [active, setActive] = useState(() => window.location.hash === EXPERIMENTS_HASH);
  useEffect(() => {
    const onChange = () => setActive(window.location.hash === EXPERIMENTS_HASH);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return active;
}

function ExperimentsLink() {
  const active = useExperimentsView();
  return (
    <a href={active ? "#" : EXPERIMENTS_HASH} className="text-xs text-slate-400 underline-offset-2 hover:underline">
      {active ? "Back to dashboard" : "Experiments"}
    </a>
  );
}

function DashboardBody() {
  const { locale } = useI18n();
  const activeTab = useUiStore((s) => s.activeTab);
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const showExperiments = useExperimentsView();
  return (
    <main className="dashboard-main min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
      {showExperiments ? (
        <ExperimentResultsPanel />
      ) : (
        <>
          {activeTab === "forecast" && <ForecastPanel />}
          {activeTab === "waste-risk" && <WasteRiskPanel />}
          {activeTab === "explain" && <ExplainChatPanel key={`${restaurantId}:${date}:${locale}`} />}
        </>
      )}
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-shell flex flex-col bg-slate-950 text-slate-100">
        <header className="app-header flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              🌱
            </span>
            <h1 className="text-lg font-semibold">VerdeAI</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ExperimentsLink />
            <DataSourceBadge />
            <LanguageSelector />
          </div>
        </header>
        <AppStatus />
        <div className="dashboard-layout flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <Sidebar />
          <DashboardBody />
        </div>
      </div>
    </QueryClientProvider>
  );
}
