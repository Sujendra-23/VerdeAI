import { useInsight } from "../hooks/useInsight";
import { useUiStore } from "../store/uiStore";

import { useI18n } from "../i18n";

export function WasteRiskPanel() {
  const { t, date: formatDate } = useI18n();
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const { data, isLoading, isError, refetch } = useInsight(restaurantId, date);

  if (isLoading) {
    return <p className="text-sm text-slate-400">{t("loadingRisk")}</p>;
  }
  if (isError) {
    return <div role="alert"><p className="text-sm text-red-400">{t("loadError")}</p><button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 rounded-md border border-slate-700 px-4 text-sm">{t("retry")}</button></div>;
  }
  if (!data || data.wasteRisk.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        {t("emptyRisk")}
      </p>
    );
  }

  const highRiskCount = data.wasteRisk.filter((w) => w.riskScore === "HIGH").length;

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">
        {t("wasteRisk")} — <bdi>{data.restaurant.name}</bdi> · {formatDate(data.date)}
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        {t("riskSummary", { count: highRiskCount, total: data.wasteRisk.length })}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.wasteRisk.map((w) => (
          <div key={w.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{w.item}</span>
              <span
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
                  w.riskScore === "HIGH"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-verde-500/15 text-verde-400"
                }`}
              >
                {t(w.riskScore === "HIGH" ? "high" : "low")}
              </span>
            </div>
            <p className="text-xs text-slate-400">{t("units", { count: w.predictedQuantity })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
