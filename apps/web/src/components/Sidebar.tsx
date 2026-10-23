import { useRestaurants } from "../hooks/useRestaurants";
import { useOpenTab } from "../hooks/useOpenTab";
import { type DashboardTab, useUiStore } from "../store/uiStore";
import { useRunVoiceCommand, useVoiceLang } from "../speech/useVoiceCommands";
import { getRecognitionConstructor } from "../speech/useSpeechRecognition";
import { VoiceButton } from "./VoiceButton";

import { useI18n } from "../i18n";

const MOCK_DATES = ["2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06"];

const TABS: Array<{ id: DashboardTab; label: "forecast" | "wasteRisk" | "explain" }> = [
  { id: "forecast", label: "forecast" },
  { id: "waste-risk", label: "wasteRisk" },
  { id: "explain", label: "explain" },
];

export function Sidebar() {
  const { t, date: formatDate } = useI18n();
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const activeTab = useUiStore((s) => s.activeTab);
  const setRestaurantId = useUiStore((s) => s.setRestaurantId);
  const setDate = useUiStore((s) => s.setDate);
  const openTab = useOpenTab();
  const voiceLang = useVoiceLang();
  const runVoiceCommand = useRunVoiceCommand(voiceLang);

  const { data: restaurants, isLoading } = useRestaurants();

  return (
    <aside className="dashboard-sidebar grid shrink-0 grid-cols-[1fr_1fr_auto] items-end gap-3 md:items-stretch border-b border-slate-800 p-4 md:flex md:w-64 md:flex-col md:gap-6 md:border-e md:border-b-0">
      <div className="min-w-0">
        <label
          htmlFor="restaurant-select"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400"
        >
          {t("restaurant")}
        </label>
        <select
          id="restaurant-select"
          className="w-full rounded-md border border-slate-700 bg-slate-900 min-h-11 px-2 py-2 text-base md:text-sm focus:border-verde-500 focus:outline-none"
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

      <div className="min-w-0">
        <label
          htmlFor="date-select"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400"
        >
          {t("date")}
        </label>
        <select
          id="date-select"
          className="w-full rounded-md border border-slate-700 bg-slate-900 min-h-11 px-2 py-2 text-base md:text-sm focus:border-verde-500 focus:outline-none"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        >
          {MOCK_DATES.map((d) => (
            <option key={d} value={d}>
              {formatDate(d)}
            </option>
          ))}
        </select>
      </div>

      {getRecognitionConstructor() && (
        <div className="md:order-last">
          <VoiceButton lang={voiceLang} onTranscript={runVoiceCommand} noteSide="below" />
        </div>
      )}

      <nav aria-label={t("dashboard")} className="dashboard-nav flex gap-1 md:flex-col">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => openTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`min-h-12 flex-1 rounded-md px-2 py-2 text-center text-xs font-medium transition-colors md:flex-none md:px-3 md:text-start md:text-sm ${
              activeTab === tab.id
                ? "bg-verde-600/20 text-verde-400"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {t(tab.label)}
          </button>
        ))}
      </nav>
    </aside>
  );
}
