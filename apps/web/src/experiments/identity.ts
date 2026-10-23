const STORAGE_KEY = "verdeai.userId";
let memoryId: string | undefined;

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Anonymous, per-browser id that keeps a manager in the same variant across visits. */
export function getExperimentUserId(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const created = randomId();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Storage may be blocked; fall back to an id that lasts for this page load.
    return (memoryId ??= randomId());
  }
}
