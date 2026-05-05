/**
 * Layer-2 fake-door pricing test storage + reporting.
 *
 * The premise: before Stephen spends a dollar on paid features (vision
 * auto-ID, cloud sync), we want a real reaction to specific price points
 * so we know which one (if any) people would actually pay. This module
 * is the boring half of that experiment — it records the user's answer
 * locally and best-effort POSTs it to a free Tally form so Stephen can
 * see results without standing up infrastructure.
 *
 * No PII is collected: just the answer, which feature was being tested,
 * the timestamp, the app version, an optional comment, and the inventory
 * size at time-of-click (a rough proxy for engagement).
 *
 * The Tally URL is OPTIONAL. If `VITE_TALLY_PRICING_URL` is unset, the
 * local log is still kept and Stephen can decide whether to set up Tally
 * later — the missing endpoint is a no-op, never an error.
 */

export type PricingAnswer =
  | "9_once"
  | "19_once"
  | "29_once"
  | "5_per_month"
  | "not_interested";

export interface PricingFeedbackEntry {
  answer: PricingAnswer;
  /** Future-proofed — today only "photo_id" is wired but cloud sync will reuse this pipe. */
  feature: "photo_id" | "cloud_sync";
  /** ISO timestamp at the moment the user clicked. */
  answered_at: string;
  /** Trackfit version when the click happened — used to disambiguate
   *  cohorts as the app evolves. Read from a constant rather than
   *  package.json so the bundle stays static at build time. */
  app_version: string;
  /** Number of inventory rows when the user answered — a rough proxy
   *  for how engaged they are. */
  inventory_size: number;
  /** Free-text comment, optional. */
  comment?: string;
}

/**
 * localStorage key. Versioned (`.v1`) so a future schema change can be
 * additive — bump to `.v2` and migrate, rather than blowing away
 * historical answers.
 */
export const PRICING_FEEDBACK_STORAGE_KEY = "trackfit.pricing_feedback.v1";

/**
 * Read the stored answer log defensively. localStorage can throw in
 * private-mode Safari or when a corporate device disables it; a corrupt
 * JSON blob (manual tampering, partial write) likewise shouldn't crash
 * the app. In any failure case we return [] so callers downstream can
 * treat "no answers yet" as the neutral default.
 */
export function listAnswers(): PricingFeedbackEntry[] {
  try {
    const raw = localStorage.getItem(PRICING_FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Light shape-guard — drop anything that obviously isn't an entry,
    // so a malformed write (or a hand-edited storage) can't poison the
    // hasAnswered() check below.
    return parsed.filter(
      (e): e is PricingFeedbackEntry =>
        !!e &&
        typeof e === "object" &&
        typeof e.answer === "string" &&
        typeof e.feature === "string" &&
        typeof e.answered_at === "string",
    );
  } catch {
    return [];
  }
}

/** Has this device already answered the pricing test for `feature`? */
export function hasAnswered(feature: PricingFeedbackEntry["feature"]): boolean {
  return listAnswers().some((e) => e.feature === feature);
}

/**
 * Persist locally + best-effort POST to the configured Tally URL.
 *
 * Order matters: write to localStorage FIRST so the user's answer is
 * captured even if the network request hangs or fails. The fetch uses
 * `keepalive: true` so it survives a navigation away from the page (the
 * modal closes immediately on click, and on mobile that often means the
 * user is about to interact with something else).
 *
 * All errors are swallowed — this is telemetry, not a critical path.
 */
export async function recordAnswer(entry: PricingFeedbackEntry): Promise<void> {
  // 1) Local persist (defensive — private mode, quota, etc.).
  try {
    const existing = listAnswers();
    existing.push(entry);
    localStorage.setItem(
      PRICING_FEEDBACK_STORAGE_KEY,
      JSON.stringify(existing),
    );
  } catch {
    /* private mode / quota / disabled storage — keep going to network */
  }

  // 2) Best-effort network. Tally accepts JSON to /r/{form_id}.
  // The URL is read at call-time (not module-init) so tests can stub
  // import.meta.env or unset the var without re-importing.
  const url =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined"
      ? (import.meta.env.VITE_TALLY_PRICING_URL as string | undefined)
      : undefined;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
      // Keepalive so the request survives the modal closing / page nav.
      keepalive: true,
    });
  } catch {
    /* offline / CORS / blocked — local log already has it */
  }
}
