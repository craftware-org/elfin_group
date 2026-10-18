import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2020",
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 900,
  },
});
