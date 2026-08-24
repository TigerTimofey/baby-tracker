import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  // Относительные пути: сборку можно открыть с любого хостинга и подпапки.
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "icon-180.png"],
      manifest: {
        name: "Малыш — дневник роста",
        short_name: "Малыш",
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
        // Приложение — одна страница, любые адреса ведут в index.html.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // В режиме разработки service worker выключен: мешает горячей перезагрузке.
        enabled: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Библиотеки меняются редко — пусть кэшируются отдельно от кода
        // приложения. При обновлении апки service worker перекачивает
        // только её часть, а не всё разом.
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
