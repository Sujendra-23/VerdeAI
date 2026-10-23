import { useEffect } from "react";
import { logConversion, logExposure } from "../experiments/tracking";
import { useExperiment } from "../hooks/useExperiment";
import { useInsight } from "../hooks/useInsight";
import { useUiStore } from "../store/uiStore";

import { useI18n } from "../i18n";

export function ForecastPanel() {
  const { t, number, date: formatDate } = useI18n();
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const { data, isLoading, isError, refetch } = useInsight(restaurantId, date);
  const variant = useExperiment("forecast-inline-risk");
  const hasForecast = Boolean(data && data.forecasts.length > 0);

  // Exposure counts only once the table the variant changes is actually on screen.
  useEffect(() => {
    if (hasForecast) logExposure("forecast-inline-risk");
  }, [hasForecast]);

  if (isLoading) {
    return <p className="text-sm text-slate-400">{t("loadingForecast")}</p>;
  }
  if (isError) {
    return <div role="alert"><p className="text-sm text-red-400">{t("loadError")}</p><button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 rounded-md border border-slate-700 px-4 text-sm">{t("retry")}</button></div>;
  }
  if (!data || data.forecasts.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        {t("emptyForecast")}
      </p>
    );
  }

  const maxQty = Math.max(...data.forecasts.map((f) => f.predictedQuantity));
  const showRisk = variant === "treatment";
  const riskByItem = new Map(data.wasteRisk.map((w) => [w.item, w.riskScore]));

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold">
        {t("forecast")} — <bdi>{data.restaurant.name}</bdi> · {formatDate(data.date)}
      </h2>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="forecast-table w-full text-sm">
          <thead className="bg-slate-900 text-start text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">{t("item")}</th>
              <th className="px-4 py-2 font-medium">{t("predicted")}</th>
              <th className="px-4 py-2 font-medium">{t("historical")}</th>
              <th className="px-4 py-2 font-medium">{t("trend")}</th>
              {showRisk && <th className="px-4 py-2 font-medium">{t("wasteRisk")}</th>}
            </tr>
          </thead>
          <tbody>
            {data.forecasts.map((f) => (
              <tr key={f.id} className="border-t border-slate-800">
                <td data-label={t("item")} className="px-4 py-2">{f.item}</td>
                <td data-label={t("predicted")} className="px-4 py-2 tabular-nums">{number(f.predictedQuantity)}</td>
                <td data-label={t("historical")} className="px-4 py-2 tabular-nums text-slate-400">
                  {number(Math.round(f.historicalAverage))}
                </td>
                <td data-label={t("trend")} className="px-4 py-2">
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-verde-500"
                      style={{ width: `${(f.predictedQuantity / (maxQty || 1)) * 100}%` }}
                    />
                  </div>
                </td>
                {showRisk && (
                  <td data-label={t("wasteRisk")} className="px-4 py-2">
                    {riskByItem.has(f.item) && (
                      <button
                        type="button"
                        data-testid="inline-risk-badge"
                        onClick={() => {
                          logConversion("forecast-inline-risk");
                          setActiveTab("waste-risk");
                        }}
                        className={`min-h-8 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
                          riskByItem.get(f.item) === "HIGH"
                            ? "bg-red-500/15 text-red-400"
                            : "bg-verde-500/15 text-verde-400"
                        }`}
                      >
                        {t(riskByItem.get(f.item) === "HIGH" ? "high" : "low")}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
