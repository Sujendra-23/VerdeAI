import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExplainChatPanel } from "./components/ExplainChatPanel";
import { ForecastPanel } from "./components/ForecastPanel";
import { Sidebar } from "./components/Sidebar";
import { WasteRiskPanel } from "./components/WasteRiskPanel";
import { useHealth } from "./hooks/useHealth";
import { useUiStore } from "./store/uiStore";

const queryClient = new QueryClient();

function DataSourceBadge() {
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
          ? "No Cosmos DB configured — serving seeded demo data"
          : "Connected to live Cosmos DB"
      }
    >
      {isMock ? "● Demo data" : "● Live Cosmos DB"}
    </span>
  );
}

function DashboardBody() {
  const activeTab = useUiStore((s) => s.activeTab);
  return (
    <main className="flex-1 overflow-y-auto p-6">
      {activeTab === "forecast" && <ForecastPanel />}
      {activeTab === "waste-risk" && <WasteRiskPanel />}
      {activeTab === "explain" && <ExplainChatPanel />}
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              🌱
            </span>
            <h1 className="text-lg font-semibold">VerdeAI Dashboard</h1>
          </div>
          <DataSourceBadge />
        </header>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <DashboardBody />
        </div>
      </div>
    </QueryClientProvider>
  );
}
