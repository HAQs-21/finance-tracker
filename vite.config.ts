import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => ({
  base: mode === "android" ? "./" : "/finance-tracker/",
  plugins: [
    react(),
    ...(mode === "android"
      ? []
      : [
          VitePWA({
            registerType: "prompt",
            includeAssets: ["morrow.svg", "icon-192.png", "icon-512.png"],
            manifest: {
              name: "Morrow",
              short_name: "Morrow",
              description:
                "Make room for tomorrow. Savings and funded budgets.",
              theme_color: "#111315",
              background_color: "#111315",
              display: "standalone",
              icons: [
                {
                  src: "icon-192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: "icon-512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any maskable",
                },
              ],
            },
            workbox: {
              cleanupOutdatedCaches: true,
              maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            },
          }),
        ]),
  ],
  build: {
    target: "es2022",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/xlsx")) return "spreadsheet";
          if (id.includes("@capacitor-community/sqlite"))
            return "native-storage";
        },
      },
    },
  },
}));
