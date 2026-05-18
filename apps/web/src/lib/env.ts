/**
 * Centralised reads for build-time environment variables.
 *
 * Vite exposes anything prefixed with `VITE_` via `import.meta.env`. The
 * type of each value is loosely `string | boolean | undefined` depending
 * on how the user wrote it in their `.env` (e.g. an unquoted `true` may
 * deserialize as a boolean by some loaders). We coerce to string here so
 * downstream callers can compare with `===` without surprises.
 *
 * The `PREMIUM` group gates the optional "Trackfit Premium" upsell row in
 * the settings menu. Every field is safe to read on a fresh checkout —
 * `enabled` defaults to `false` (row hidden), and the URL fields default
 * to empty strings which the modal treats as "Coming soon" placeholders.
 *
 * IMPORTANT: keep this module side-effect-free. It's imported during
 * render and at the top of test files; doing work at import time would
 * couple unrelated modules to whatever happens here.
 */

const asString = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

export const PREMIUM = {
  /**
   * When false (the default), the entire premium row is omitted from the
   * settings menu. This keeps the UI clean for users who don't see the
   * feature yet.
   */
  enabled: asString(import.meta.env.VITE_PREMIUM_ENABLED) === "true",
  /**
   * Display price for the one-time Founder tier. Free-form string. The
   * launch model is a single one-time "Founder" license — no
   * subscription (this audience resents recurring billing and the hobby
   * buys software once). $19 is the launch anchor; Founders keep their
   * price if it rises later. Override with VITE_PREMIUM_LIFETIME_PRICE.
   */
  lifetimePrice: asString(import.meta.env.VITE_PREMIUM_LIFETIME_PRICE) || "$19",
  /** Display price for the (currently unused) monthly tier. */
  monthlyPrice: asString(import.meta.env.VITE_PREMIUM_MONTHLY_PRICE) || "$3/mo",
  /**
   * Stripe / Lemon Squeezy outbound URL for the lifetime tier. Empty
   * string means "Coming soon" — the card renders disabled.
   */
  lifetimeUrl: asString(import.meta.env.VITE_PREMIUM_LIFETIME_URL),
  /** Same idea for the monthly tier. Empty → "Coming soon". */
  monthlyUrl: asString(import.meta.env.VITE_PREMIUM_MONTHLY_URL),
};

/**
 * Discord invite URL for the tester feedback channel. Empty string =
 * the "Give feedback" row simply doesn't render. Set
 * VITE_DISCORD_FEEDBACK_URL to a Discord invite (e.g.
 * https://discord.gg/abcdef) when the server is ready.
 */
export const FEEDBACK = {
  discordUrl: asString(import.meta.env.VITE_DISCORD_FEEDBACK_URL),
};
