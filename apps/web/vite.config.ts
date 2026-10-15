import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: "prompt",
    injectRegister: "auto",
    includeAssets: ["icons/*.png"],
    manifest: {
      id: "/", name: "VerdeAI", short_name: "VerdeAI",
      description: "Restaurant forecasts, waste risk, and AI insights",
      start_url: "/", scope: "/", display: "standalone",
      background_color: "#020617", theme_color: "#020617",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      clientsClaim: true,
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      navigateFallbackDenylist: [/^\/api\//, /^\/graphql/],
    },
  })],
  build: { outDir: "dist" },
  resolve: {
    alias: {
      // packages/shared-types ships raw .ts with no build step; alias it
      // directly to source so Vite transforms it like any other project file.
      "@verdeai/shared-types": path.resolve(
        __dirname,
        "../../packages/shared-types/src/index.ts",
      ),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: { "/api": "http://localhost:4000", "/graphql": "http://localhost:4000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
  },
  };
});
