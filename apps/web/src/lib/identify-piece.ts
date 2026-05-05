/**
 * Photo-ID for track pieces — Layer 1 (stubbed).
 *
 * v0.4 Phase 1: this returns plausible fake data so the front-end flow
 * (capture → identify → auto-fill / candidate-confirm) can be validated
 * with an older hobbyist tester before we spend a single Anthropic
 * vision API dollar. The shape of the response matches what a real
 * vision-backed identifier will return; only the source of the
 * candidates is fake.
 *
 * Wiring for the real call lives behind `VITE_USE_REAL_PHOTO_ID`. When
 * that env flag flips to "true", this function attempts a fetch to
 * `/api/identify-piece` (a server-side proxy under
 * `supabase/functions/identify-piece/`) and falls back to the stub on
 * any error. The proxy is the *only* place the Anthropic API key
 * lives — the browser never sees it.
 */

import { listSystems, type TrackPiece, type TrackSystem } from "@trackfit/library";

export interface IdentifyCandidate {
  label: string;
  /** 0..1 — soft confidence the model is right. */
  confidence: number;
  length_mm: number;
  kind: "straight" | "curve" | "turnout" | "crossing" | "fitter" | "flex";
  radius_mm?: number;
  arc_degrees?: number;
  product_code?: string;
  /**
   * Manufacturer / system this came from, e.g. "Lionel FasTrack".
   * Surfaced as the secondary line in the candidate sheet so the
   * hobbyist can rule out a guess at a glance ("nope, mine's Atlas").
   */
  system_label?: string;
}

export interface IdentifyResult {
  candidates: IdentifyCandidate[];
  /** True iff this came from a real backend call. False for stubs. */
  fromStub: boolean;
}

interface ContextHint {
  activePresetId?: string | null;
}

/**
 * Top-1 confidence above this auto-fills the row silently (with a
 * "tap to confirm" affordance). Below it, we open the candidate
 * confirm sheet so the user picks. The threshold is in this module
 * rather than App.tsx so the stub generator can target it deliberately
 * during development (e.g. lower the floor to test the modal path).
 */
export const AUTO_FILL_CONFIDENCE_THRESHOLD = 0.85;

/** Stub delay range — the UI feels real with at least 500ms of latency. */
const STUB_DELAY_MS = 600;

/**
 * Default fallback when no preset is loaded: three plausible HO
 * Atlas Code 83 candidates. Picked because HO is the most popular
 * scale and Atlas Code 83 is the de-facto reference for "what does
 * a track piece look like in this scale?".
 */
const HO_DEFAULTS: IdentifyCandidate[] = [
  {
    label: '9" straight',
    confidence: 0.91,
    length_mm: 228.6,
    kind: "straight",
    product_code: "ATL-520",
    system_label: "Atlas HO Code 83",
  },
  {
    label: '6" straight',
    confidence: 0.78,
    length_mm: 152.4,
    kind: "straight",
    product_code: "ATL-521",
    system_label: "Atlas HO Code 83",
  },
  {
    label: '22" radius curve',
    confidence: 0.62,
    length_mm: 219.4,
    kind: "curve",
    radius_mm: 558.8,
    arc_degrees: 22.5,
    product_code: "ATL-525",
    system_label: "Atlas HO Code 83",
  },
];

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** Pull `n` distinct random pieces from a system that have usable geometry. */
function sampleSystemPieces(system: TrackSystem, n: number): TrackPiece[] {
  const usable = system.pieces.filter((p) => {
    const hasLen = typeof p.length_mm === "number" && (p.length_mm as number) > 0;
    const hasCurve =
      typeof p.radius_mm === "number" &&
      typeof p.arc_degrees === "number" &&
      (p.radius_mm as number) > 0 &&
      (p.arc_degrees as number) > 0;
    return hasLen || hasCurve;
  });
  // Fisher-Yates partial shuffle.
  const arr = usable.slice();
  for (let i = arr.length - 1; i > 0 && i >= arr.length - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr.slice(Math.max(0, arr.length - n)).reverse();
}

/**
 * Map a TrackPiece (library shape) onto an IdentifyCandidate (UI shape).
 * Confidence is supplied by the caller because it depends on the
 * candidate's rank (0.91 / 0.78 / 0.62 by default).
 */
function pieceToCandidate(
  piece: TrackPiece,
  confidence: number,
  systemLabel: string,
): IdentifyCandidate | null {
  const kind = piece.kind;
  // Only the kinds the auto-fill flow knows how to write back to the
  // inventory row are eligible. Rerailers, bumpers, etc. would need
  // additional fields and aren't worth a stub return path yet.
  if (
    kind !== "straight" &&
    kind !== "curve" &&
    kind !== "turnout" &&
    kind !== "crossing" &&
    kind !== "fitter" &&
    kind !== "flex"
  ) {
    return null;
  }

  const hasLen = typeof piece.length_mm === "number" && (piece.length_mm as number) > 0;
  const hasCurve =
    typeof piece.radius_mm === "number" &&
    typeof piece.arc_degrees === "number" &&
    (piece.radius_mm as number) > 0 &&
    (piece.arc_degrees as number) > 0;

  let length_mm: number;
  if (hasLen) {
    length_mm = piece.length_mm as number;
  } else if (hasCurve) {
    // Arc length so the inventory row's length field stays consistent
    // with how presetToInventory derives it (r·θ_rad).
    length_mm =
      (piece.radius_mm as number) *
      (piece.arc_degrees as number) *
      (Math.PI / 180);
  } else {
    return null;
  }

  const out: IdentifyCandidate = {
    label: piece.label,
    confidence,
    length_mm,
    kind,
    system_label: systemLabel,
  };
  if (hasCurve) {
    out.radius_mm = piece.radius_mm as number;
    out.arc_degrees = piece.arc_degrees as number;
  }
  if (piece.product_code) out.product_code = piece.product_code;
  return out;
}

/**
 * Build three stub candidates. If a preset is active, sample from
 * it so the candidates feel relevant to what the user is actually
 * inventorying. Otherwise fall back to HO Atlas Code 83 defaults.
 *
 * v0.3.3 — confidences are now FIXED, not jittered. Focus-group
 * persona Margaret was getting different outcomes (auto-fill vs
 * candidate sheet) for the same gesture because the jittered top-1
 * straddled the AUTO_FILL_CONFIDENCE_THRESHOLD ~17% of the time.
 * Tech-skeptical users read that variance as "the app is unreliable."
 * The real Vision API will have content-driven variance once it's
 * wired; the stub shouldn't pretend.
 */
function buildStubCandidates(hint?: ContextHint): IdentifyCandidate[] {
  // Top-1 is locked above the auto-fill threshold so the stub always
  // demonstrates the magic gesture; #2 and #3 sit below threshold so
  // they show meaningful "less sure" hierarchy in the sheet UI when
  // the auto-fill path is bypassed (e.g. the row already had a label).
  const baseConfidences = [0.95, 0.72, 0.55];

  if (hint?.activePresetId) {
    const system = listSystems().find((s) => s.id === hint.activePresetId);
    if (system) {
      const picks = sampleSystemPieces(system, 3);
      const mapped: IdentifyCandidate[] = [];
      for (let i = 0; i < picks.length; i++) {
        const c = pieceToCandidate(
          picks[i]!,
          clamp01(baseConfidences[i] ?? 0.5),
          system.name,
        );
        if (c) mapped.push(c);
      }
      if (mapped.length >= 2) return mapped;
      // If the system somehow yielded <2 usable pieces, fall through
      // to the HO defaults rather than returning a thin list.
    }
  }

  return HO_DEFAULTS.map((c, i) => ({
    ...c,
    confidence: baseConfidences[i] ?? c.confidence,
  }));
}

/**
 * Simulate network latency. The 500–800ms target makes the
 * "Identifying…" affordance feel real rather than instant — older
 * users read the affordance, and an instant return reads as "nothing
 * happened" rather than "the app worked".
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Whether the real (server-proxied) vision call should be attempted.
 * Wrapped in a function so tests / Storybook can stub `import.meta.env`
 * without re-evaluating module-load constants.
 */
function realPhotoIdEnabled(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any).env;
    return env?.VITE_USE_REAL_PHOTO_ID === "true";
  } catch {
    return false;
  }
}

/**
 * URL of the photo-ID proxy. Set at build time via the
 * VITE_PHOTO_ID_PROXY_URL env var; in v0.3.4 this points to a
 * Cloudflare Worker (see infra/cloudflare-worker/). Falls back to
 * `/api/identify-piece` so a future Vite-proxied dev setup or a
 * same-origin deploy still works.
 */
function photoIdProxyUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any).env;
    const url = typeof env?.VITE_PHOTO_ID_PROXY_URL === "string" ? env.VITE_PHOTO_ID_PROXY_URL.trim() : "";
    return url.length > 0 ? url : "/api/identify-piece";
  } catch {
    return "/api/identify-piece";
  }
}

/**
 * Real call wrapper. The Cloudflare Worker (or any compatible proxy)
 * is the only place the Anthropic key lives — never expose it to the
 * client. On any failure, return null and let the caller fall back
 * to the stub (handoff §3 — never block the user).
 */
async function tryRealIdentify(
  photoBase64: string,
  hint?: ContextHint,
): Promise<IdentifyResult | null> {
  try {
    const res = await fetch(photoIdProxyUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photo_base64: photoBase64,
        active_preset_id: hint?.activePresetId ?? null,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as IdentifyResult;
    if (!data || !Array.isArray(data.candidates)) return null;
    return { ...data, fromStub: false };
  } catch {
    return null;
  }
}

/**
 * Identify a track piece from a photo. Returns up to three candidate
 * guesses with descending confidence. The caller decides whether to
 * auto-fill (top-1 ≥ AUTO_FILL_CONFIDENCE_THRESHOLD) or open the
 * candidate-confirm sheet.
 *
 * `photoBase64` is unused in the stub but sits in the signature so
 * the call site never has to change when we swap implementations.
 */
export async function identifyPiece(
  photoBase64: string,
  contextHint?: ContextHint,
): Promise<IdentifyResult> {
  if (realPhotoIdEnabled()) {
    const real = await tryRealIdentify(photoBase64, contextHint);
    if (real) return real;
    // Fall through to the stub — never block the user (handoff §3).
  }

  await delay(STUB_DELAY_MS);
  return {
    candidates: buildStubCandidates(contextHint),
    fromStub: true,
  };
}
