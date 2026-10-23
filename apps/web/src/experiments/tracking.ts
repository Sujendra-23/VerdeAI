import { EXPERIMENTS, assignVariant, type ExperimentEvent, type ExperimentId } from "@verdeai/shared-types";
import { getExperimentUserId } from "./identity";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const sentExposures = new Set<string>();

function send(event: ExperimentEvent): void {
  // Fire and forget: analytics must never break or slow the dashboard.
  void fetch(`${API_URL}/api/experiments/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}

export function getVariant(experimentId: ExperimentId): string {
  return assignVariant(experimentId, getExperimentUserId());
}

/** Log that this user saw the experiment; once per page load (the server also keeps one per user). */
export function logExposure(experimentId: ExperimentId): void {
  const userId = getExperimentUserId();
  if (sentExposures.has(`${experimentId}:${userId}`)) return;
  sentExposures.add(`${experimentId}:${userId}`);
  send({ experimentId, userId, variant: assignVariant(experimentId, userId), type: "exposure" });
}

export function logConversion(experimentId: ExperimentId): void {
  const userId = getExperimentUserId();
  send({
    experimentId,
    userId,
    variant: assignVariant(experimentId, userId),
    type: "conversion",
    event: EXPERIMENTS[experimentId].conversionEvent,
  });
}

/** Test hook: forget which exposures this page load already sent. */
export function resetExposureLog(): void {
  sentExposures.clear();
}
