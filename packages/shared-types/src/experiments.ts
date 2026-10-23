/**
 * A/B experiment definitions and deterministic variant assignment, shared by the
 * dashboard (which assigns and logs events) and the API (which re-computes the
 * assignment so a tampered variant is rejected).
 */

export type ExperimentEventType = "exposure" | "conversion";

export interface ExperimentDefinition {
  id: string;
  description: string;
  /** Variant names in bucket order; weights are percentages that sum to 100. */
  variants: ReadonlyArray<{ name: string; weight: number }>;
  /** The one conversion event this experiment is judged on. */
  conversionEvent: string;
}

export const EXPERIMENTS = {
  "forecast-inline-risk": {
    id: "forecast-inline-risk",
    description:
      "Show each item's waste-risk badge inside the forecast table, and let a click open the Waste Risk tab.",
    variants: [
      { name: "control", weight: 50 },
      { name: "treatment", weight: 50 },
    ],
    conversionEvent: "waste_risk_opened",
  },
} as const satisfies Record<string, ExperimentDefinition>;

export type ExperimentId = keyof typeof EXPERIMENTS;

export function isExperimentId(value: unknown): value is ExperimentId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EXPERIMENTS, value);
}

/** 32-bit FNV-1a. Small, dependency-free, and identical in the browser and Node. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Stable bucket in [0, 100) for a user and experiment; the experiment id keeps cohorts independent. */
export function experimentBucket(experimentId: string, userId: string): number {
  return fnv1a(`${experimentId}\u0000${userId}`) % 100;
}

/** Same user and experiment always give the same variant; changing weights only moves the boundary users. */
export function assignVariant(experimentId: ExperimentId, userId: string): string {
  const definition: ExperimentDefinition = EXPERIMENTS[experimentId];
  const bucket = experimentBucket(experimentId, userId);
  let upper = 0;
  for (const variant of definition.variants) {
    upper += variant.weight;
    if (bucket < upper) return variant.name;
  }
  return definition.variants[definition.variants.length - 1]!.name;
}

export interface ExperimentEvent {
  experimentId: string;
  userId: string;
  variant: string;
  type: ExperimentEventType;
  /** Required for conversions; must equal the experiment's conversion event. */
  event?: string;
}

export interface VariantResult {
  variant: string;
  /** Distinct users who saw this variant. */
  exposures: number;
  /** Distinct exposed users who converted. */
  conversions: number;
  rate: number;
}

export interface ExperimentResults {
  experimentId: string;
  conversionEvent: string;
  variants: VariantResult[];
  /** Relative change of the last variant's rate against the first (control); null when control has no conversions. */
  lift: number | null;
  /** Two-proportion z statistic for last vs first variant; null when either arm has no exposures. */
  zScore: number | null;
  verdict: "not-enough-data" | "no-significant-difference" | "significant";
}

/** Minimum distinct exposed users per arm before a significance verdict is shown. */
export const MIN_EXPOSURES_PER_VARIANT = 30;

export function summarizeExperiment(
  definition: ExperimentDefinition,
  counts: Record<string, { exposures: number; conversions: number }>,
): ExperimentResults {
  const variants: VariantResult[] = definition.variants.map(({ name }) => {
    const { exposures = 0, conversions = 0 } = counts[name] ?? {};
    return { variant: name, exposures, conversions, rate: exposures === 0 ? 0 : conversions / exposures };
  });
  const control = variants[0]!;
  const treatment = variants[variants.length - 1]!;
  const lift = control.rate === 0 ? null : (treatment.rate - control.rate) / control.rate;

  let zScore: number | null = null;
  if (control.exposures > 0 && treatment.exposures > 0) {
    const pooled = (control.conversions + treatment.conversions) / (control.exposures + treatment.exposures);
    const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / control.exposures + 1 / treatment.exposures));
    zScore = standardError === 0 ? 0 : (treatment.rate - control.rate) / standardError;
  }

  const enough = variants.every((v) => v.exposures >= MIN_EXPOSURES_PER_VARIANT);
  const verdict = !enough
    ? "not-enough-data"
    : zScore !== null && Math.abs(zScore) >= 1.96
      ? "significant"
      : "no-significant-difference";
  return { experimentId: definition.id, conversionEvent: definition.conversionEvent, variants, lift, zScore, verdict };
}
