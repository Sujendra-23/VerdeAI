import { useInsight } from "../hooks/useInsight";
import { useUiStore } from "../store/uiStore";

import { useI18n } from "../i18n";

export function ForecastPanel() {
  const { t, number, date: formatDate } = useI18n();
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const { data, isLoading, isError, refetch } = useInsight(restaurantId, date);

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
