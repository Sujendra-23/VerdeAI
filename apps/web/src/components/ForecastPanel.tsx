import { useInsight } from "../hooks/useInsight";
import { useUiStore } from "../store/uiStore";

export function ForecastPanel() {
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const { data, isLoading, isError, error } = useInsight(restaurantId, date);

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading forecast…</p>;
  }
  if (isError) {
    return <p className="text-sm text-red-400">{(error as Error).message}</p>;
  }
  if (!data || data.forecasts.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No forecast data for this restaurant and date yet.
      </p>
    );
  }

  const maxQty = Math.max(...data.forecasts.map((f) => f.predictedQuantity));

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold">
        Demand Forecast — {data.restaurant.name} · {data.date}
      </h2>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Predicted</th>
              <th className="px-4 py-2 font-medium">Historical Avg</th>
              <th className="px-4 py-2 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {data.forecasts.map((f) => (
              <tr key={f.id} className="border-t border-slate-800">
                <td className="px-4 py-2">{f.item}</td>
                <td className="px-4 py-2 tabular-nums">{f.predictedQuantity}</td>
                <td className="px-4 py-2 tabular-nums text-slate-400">
                  {Math.round(f.historicalAverage)}
                </td>
                <td className="px-4 py-2">
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-verde-500"
                      style={{ width: `${(f.predictedQuantity / maxQty) * 100}%` }}
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
