import { useInsight } from "../hooks/useInsight";
import { useUiStore } from "../store/uiStore";

export function WasteRiskPanel() {
  const restaurantId = useUiStore((s) => s.restaurantId);
  const date = useUiStore((s) => s.date);
  const { data, isLoading, isError, error } = useInsight(restaurantId, date);

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading waste risk…</p>;
  }
  if (isError) {
    return <p className="text-sm text-red-400">{(error as Error).message}</p>;
  }
  if (!data || data.wasteRisk.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No waste-risk data for this restaurant and date yet.
      </p>
    );
  }

  const highRiskCount = data.wasteRisk.filter((w) => w.riskScore === "HIGH").length;

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">
        Waste Risk — {data.restaurant.name} · {data.date}
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        {highRiskCount} of {data.wasteRisk.length} items flagged HIGH risk today.
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
                {w.riskScore}
              </span>
            </div>
            <p className="text-xs text-slate-400">Predicted: {w.predictedQuantity} units</p>
          </div>
        ))}
      </div>
    </div>
  );
}
