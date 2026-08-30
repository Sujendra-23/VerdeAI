import { useRestaurants } from "../hooks/useRestaurants";
import { type DashboardTab, useUiStore } from "../store/uiStore";

const MOCK_DATES = ["2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06"];

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "forecast", label: "Demand Forecast" },
  { id: "waste-risk", label: "Waste Risk" },
  { id: "explain", label: "AI Explain" },
];

export function Sidebar() {
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const activeTab = useUiStore((s) => s.activeTab);
  const setRestaurantId = useUiStore((s) => s.setRestaurantId);
  const setDate = useUiStore((s) => s.setDate);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

  const { data: restaurants, isLoading } = useRestaurants();

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col gap-6 border-r border-slate-800 p-4">
      <div>
        <label
          htmlFor="restaurant-select"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400"
        >
          Restaurant
        </label>
        <select
          id="restaurant-select"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm focus:border-verde-500 focus:outline-none"
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          disabled={isLoading}
        >
          {(restaurants ?? []).map((r) => (
            <option key={r.restaurantId} value={r.restaurantId}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="date-select"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400"
        >
          Date
        </label>
        <select
          id="date-select"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm focus:border-verde-500 focus:outline-none"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        >
          {MOCK_DATES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex flex-col gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-verde-600/20 text-verde-400"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
