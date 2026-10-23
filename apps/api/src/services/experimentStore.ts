import {
  EXPERIMENTS,
  assignVariant,
  isExperimentId,
  summarizeExperiment,
  type ExperimentEvent,
  type ExperimentId,
  type ExperimentResults,
} from "@verdeai/shared-types";

export type RecordOutcome =
  | { status: "recorded" }
  | { status: "duplicate" }
  | { status: "ignored"; reason: string }
  | { status: "invalid"; reason: string };

const MAX_USER_ID_LENGTH = 64;

/**
 * In-memory experiment event store. Counts are distinct users, so reloads and
 * repeated clicks never inflate a variant. State is lost on restart; this is a
 * demo-scale store, not an analytics pipeline.
 */
export class ExperimentStore {
  private readonly exposed = new Map<ExperimentId, Map<string, string>>();
  private readonly converted = new Map<ExperimentId, Set<string>>();

  record(event: ExperimentEvent): RecordOutcome {
    if (!isExperimentId(event.experimentId)) return { status: "invalid", reason: "unknown experiment" };
    const experimentId = event.experimentId;
    const definition = EXPERIMENTS[experimentId];

    if (typeof event.userId !== "string" || event.userId.length === 0 || event.userId.length > MAX_USER_ID_LENGTH) {
      return { status: "invalid", reason: `userId must be 1-${MAX_USER_ID_LENGTH} characters` };
    }
    // Recompute the assignment so a client cannot report a variant it was not given.
    if (event.variant !== assignVariant(experimentId, event.userId)) {
      return { status: "invalid", reason: "variant does not match this user's assignment" };
    }

    const exposedUsers = this.exposed.get(experimentId) ?? new Map<string, string>();
    this.exposed.set(experimentId, exposedUsers);

    if (event.type === "exposure") {
      if (exposedUsers.has(event.userId)) return { status: "duplicate" };
      exposedUsers.set(event.userId, event.variant);
      return { status: "recorded" };
    }
    if (event.type === "conversion") {
      if (event.event !== definition.conversionEvent) return { status: "invalid", reason: "unknown conversion event" };
      // A conversion only counts for a user we have seen exposed.
      if (!exposedUsers.has(event.userId)) return { status: "ignored", reason: "user has no exposure" };
      const convertedUsers = this.converted.get(experimentId) ?? new Set<string>();
      this.converted.set(experimentId, convertedUsers);
      if (convertedUsers.has(event.userId)) return { status: "duplicate" };
      convertedUsers.add(event.userId);
      return { status: "recorded" };
    }
    return { status: "invalid", reason: "type must be exposure or conversion" };
  }

  results(experimentId: ExperimentId): ExperimentResults {
    const counts: Record<string, { exposures: number; conversions: number }> = {};
    const bump = (variant: string) => (counts[variant] ??= { exposures: 0, conversions: 0 });
    for (const variant of this.exposed.get(experimentId)?.values() ?? []) bump(variant).exposures++;
    for (const userId of this.converted.get(experimentId) ?? []) {
      const variant = this.exposed.get(experimentId)?.get(userId);
      if (variant) bump(variant).conversions++;
    }
    return summarizeExperiment(EXPERIMENTS[experimentId], counts);
  }
}
