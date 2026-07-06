// Minimal write-access to the Intel Watch analyst workspace from other
// screens ("Send to Intel Watch"). Kept separate from IntelWatchMap so the
// Monitor screen does not import the heavy map module for a storage write.
//
// The workspace schema is owned by IntelWatchMap; pins written here match its
// `Pin` shape exactly and are re-validated by `sanitizePin` on restore, so a
// drifting write can never poison the map state.

/** Persisted analyst workspace (survives tab switches / reloads). */
export const INTEL_WATCH_STORAGE_KEY = "echis.intel-watch.v1";

export type IntelWatchPinInput = {
  /** Stable id of the originating item — used to deduplicate repeat sends. */
  itemId: string;
  lng: number;
  lat: number;
  title: string;
  source: string;
  /** Display timestamp (e.g. the item's published date). */
  updated: string;
  note?: string;
};

type StoredPin = {
  id: string;
  lng: number;
  lat: number;
  type: "facility";
  severity: "medium";
  title: string;
  source: string;
  updated: string;
  note: string;
};

export type SendToIntelWatchResult = "added" | "exists" | "unavailable";

/**
 * Append a pin to the persisted Intel Watch workspace. Returns "exists" when
 * the same item was already sent (matched by the derived pin id), so callers
 * can surface an honest "already in workspace" state.
 */
export function sendToIntelWatch(input: IntelWatchPinInput): SendToIntelWatchResult {
  if (typeof window === "undefined") return "unavailable";
  if (!Number.isFinite(input.lng) || !Number.isFinite(input.lat)) return "unavailable";

  let workspace: { pins?: unknown[]; annotations?: unknown[] } = {};
  try {
    const raw = window.localStorage.getItem(INTEL_WATCH_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        workspace = parsed as { pins?: unknown[]; annotations?: unknown[] };
      }
    }
  } catch {
    // Corrupt store: fall through with an empty workspace; IntelWatchMap's
    // sanitizers apply the same recovery on its side.
  }

  const pins = Array.isArray(workspace.pins) ? workspace.pins : [];
  const pinId = `pin-sent-${input.itemId}`;
  const exists = pins.some(
    (pin) =>
      typeof pin === "object" &&
      pin !== null &&
      (pin as { id?: unknown }).id === pinId,
  );
  if (exists) return "exists";

  const pin: StoredPin = {
    id: pinId,
    lng: Math.max(-180, Math.min(180, input.lng)),
    lat: Math.max(-85, Math.min(85, input.lat)),
    type: "facility",
    severity: "medium",
    title: input.title || "Untitled marker",
    source: input.source || "Monitor",
    updated: input.updated || "—",
    note: input.note ?? "",
  };

  try {
    window.localStorage.setItem(
      INTEL_WATCH_STORAGE_KEY,
      JSON.stringify({
        pins: [...pins, pin],
        annotations: Array.isArray(workspace.annotations) ? workspace.annotations : [],
      }),
    );
  } catch {
    return "unavailable";
  }
  return "added";
}
