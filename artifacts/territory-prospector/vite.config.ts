import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Standalone tool — no Replit plugins, no required env for local dev.
// PORT is optional (defaults to 5173); BASE_PATH is optional (defaults to /).
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
