import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "assets",
  build: {
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
});
