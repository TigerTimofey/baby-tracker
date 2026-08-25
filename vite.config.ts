import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "icon-180.png"],
      manifest: {
        name: "Sebason — дневник роста",
        short_name: "Sebason",
        description: "Сон, вес, рост и первые достижения малыша",
        lang: "ru",
        dir: "ltr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f0f17",
        theme_color: "#12121b",
        categories: ["health", "lifestyle"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],

        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/scheduler")
          ) {
            return "react";
          }
          return undefined;
        },
      },
    },
  },
});
