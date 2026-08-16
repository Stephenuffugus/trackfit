import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Trackfit PWA — Vite config.
// We let vite-plugin-pwa generate the service worker but reuse our existing
// hand-authored manifest.webmanifest from /public so the icons and brand
// metadata stay in lockstep with the original v0.2 PWA setup.
// GitHub Pages serves this project at https://stephenuffugus.github.io/trackfit/
// so we need the deployed bundle's asset URLs to be prefixed with /trackfit/.
// Vite respects VITE_BASE_PATH if set (the Pages workflow sets it). For local
// dev the default "/" path keeps `pnpm dev` clean.
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Our /public/manifest.webmanifest is the source of truth — don't let
      // the plugin overwrite it with a generated one.
      manifest: false,
      includeAssets: ["icon.svg", "icon-maskable.svg", "manifest.webmanifest"],
      workbox: {
        // Allow our base64 photos and Google Fonts to be cached at runtime.
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,woff2}"],
        /* No runtimeCaching for fonts any more: they are self-hosted in
           /fonts and picked up by globPatterns, so there is nothing left to
           fetch at runtime. Keeping the Google rules would have quietly
           re-enabled the request the moment a stylesheet referenced them. */
      },
    }),
  ],
});
