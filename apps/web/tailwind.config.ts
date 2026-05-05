import type { Config } from "tailwindcss";

/**
 * Trackfit Tailwind theme.
 *
 * The blueprint design tokens from v0.2 (trackfit-1.html lines 32-50) are
 * mirrored here as Tailwind colors. Custom CSS that Tailwind handles badly
 * (the blueprint grid background, specimen-frame corner ticks, hatched empty
 * photos, the "SUGGESTED" stamp) lives in `src/styles/index.css`.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f4ede0",
        "bg-elev": "#fdf8ee",
        ink: "#1a2238",
        "ink-soft": "#4a5169",
        rule: "#c9bfa8",
        accent: "#b24b2b",
        brass: "#9a7b3f",
        good: "#4f6b3a",
        "bar-1": "#b24b2b",
        "bar-2": "#2e4a6b",
        "bar-3": "#9a7b3f",
        "bar-4": "#4f6b3a",
        "bar-5": "#6b4a6b",
        "bar-6": "#8b5a2b",
        "bar-7": "#3a6b6b",
        "bar-8": "#b28a2b",
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
