import { defineConfig } from "vite";

export default defineConfig({
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
