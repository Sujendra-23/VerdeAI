import { useMemo } from "react";
import type { ExperimentId } from "@verdeai/shared-types";
import { getVariant } from "../experiments/tracking";

/** The variant this browser is assigned for an experiment; stable across renders and visits. */
export function useExperiment(experimentId: ExperimentId): string {
  return useMemo(() => getVariant(experimentId), [experimentId]);
}
