import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.morrow.finance",
  appName: "Morrow",
  webDir: "dist",
  backgroundColor: "#111315",
  android: {
    backgroundColor: "#111315",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    zoomEnabled: true,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    SystemBars: {
      style: "DARK",
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
