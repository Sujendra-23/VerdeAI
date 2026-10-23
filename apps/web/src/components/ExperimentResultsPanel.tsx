import { useQuery } from "@tanstack/react-query";
import { EXPERIMENTS, MIN_EXPOSURES_PER_VARIANT, type ExperimentId } from "@verdeai/shared-types";
import { fetchExperimentResults } from "../api/client";

const EXPERIMENT_ID: ExperimentId = "forecast-inline-risk";

const VERDICTS = {
  "not-enough-data": `Not enough data yet: each variant needs ${MIN_EXPOSURES_PER_VARIANT}+ exposed managers before a verdict is shown.`,
  "no-significant-difference": "No significant difference at the 95% level.",
  significant: "Significant difference at the 95% level.",
} as const;

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

/** Internal view of the running experiment. Labels are English only; it is an analyst page, not a manager screen. */
export function ExperimentResultsPanel() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["experiment-results", EXPERIMENT_ID],
    queryFn: () => fetchExperimentResults(EXPERIMENT_ID),
    refetchInterval: 10_000,
  });
  const definition = EXPERIMENTS[EXPERIMENT_ID];

  if (isLoading) return <p className="text-sm text-slate-400">Loading experiment results…</p>;
  if (isError || !data) {
    return (
      <div role="alert">
        <p className="text-sm text-red-400">Could not load experiment results.</p>
        <button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 rounded-md border border-slate-700 px-4 text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">Experiment: {definition.id}</h2>
      <p className="mb-4 text-sm text-slate-400">{definition.description}</p>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <caption className="sr-only">Exposed managers and {data.conversionEvent} conversions by variant</caption>
          <thead className="bg-slate-900 text-start text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Variant</th>
              <th className="px-4 py-2 font-medium">Exposed</th>
              <th className="px-4 py-2 font-medium">Converted</th>
              <th className="px-4 py-2 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.variants.map((v) => (
              <tr key={v.variant} className="border-t border-slate-800">
                <th scope="row" className="px-4 py-2 text-start font-medium">{v.variant}</th>
                <td className="px-4 py-2 tabular-nums">{v.exposures}</td>
                <td className="px-4 py-2 tabular-nums">{v.conversions}</td>
                <td className="px-4 py-2 tabular-nums">{percent(v.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm" data-testid="experiment-verdict">
        {data.lift !== null && `Relative lift: ${data.lift >= 0 ? "+" : ""}${percent(data.lift)}. `}
        {VERDICTS[data.verdict]}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Conversion = opened Waste Risk ({data.conversionEvent}). Counts are distinct managers and reset when the API restarts.
      </p>
    </div>
  );
}
