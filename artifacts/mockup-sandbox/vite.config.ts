import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

// PORT / BASE_PATH were injected by Replit. Off-Replit they are optional:
// default to a standard dev port and a root base path so `build` and `dev`
// work with no environment setup.
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5174;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// Replit-only Vite plugins. Loaded (dynamically, so the packages are not
// required off-Replit) only when running inside a Replit workspace.
const isReplit =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined;

const replitPlugins = isReplit
  ? [
      await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
        m.default(),
      ),
      await import("@replit/vite-plugin-cartographer").then((m) =>
        m.cartographer({
          root: path.resolve(import.meta.dirname, ".."),
        }),
      ),
    ]
  : [];

export default defineConfig({
  base: basePath,
  plugins: [mockupPreviewPlugin(), react(), tailwindcss(), ...replitPlugins],
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
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
