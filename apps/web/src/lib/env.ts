/**
 * Centralised reads for build-time environment variables.
 *
 * Vite exposes anything prefixed with `VITE_` via `import.meta.env`. The
 * type of each value is loosely `string | boolean | undefined` depending
 * on how the user wrote it in their `.env` (e.g. an unquoted `true` may
 * deserialize as a boolean by some loaders). We coerce to string here so
 * downstream callers can compare with `===` without surprises.
 *
 * Trackfit has no paid tier and no gated features — every capability the
 * app has is available to every user, offline, with no account. There is
 * therefore nothing here that can turn a feature off; the only knob left
 * is an optional feedback link.
 *
 * IMPORTANT: keep this module side-effect-free. It's imported during
 * render and at the top of test files; doing work at import time would
 * couple unrelated modules to whatever happens here.
 */

const asString = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

/**
 * Discord invite URL for the tester feedback channel. Empty string =
 * the "Give feedback" row simply doesn't render. Set
 * VITE_DISCORD_FEEDBACK_URL to a Discord invite (e.g.
 * https://discord.gg/abcdef) when the server is ready.
 */
export const FEEDBACK = {
  discordUrl: asString(import.meta.env.VITE_DISCORD_FEEDBACK_URL),
};
