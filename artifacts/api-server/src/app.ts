import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Single-service deploy: serve the built web app from the same origin as the
// API, so the app's same-origin `/api` cookie requests work with no proxy or
// CORS. The API bundles to dist/index.mjs; the web build lives alongside it at
// ../franchise-dev-os/dist/public. Override with WEB_DIST. When the build is
// absent (e.g. running the API alone in dev), this is skipped and the API
// serves in API-only mode.
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const webDist =
  process.env.WEB_DIST ??
  path.resolve(serverDir, "..", "..", "franchise-dev-os", "dist", "public");
const webIndex = path.join(webDist, "index.html");
const serveWeb = fs.existsSync(webIndex);

if (serveWeb) {
  // Mounted before authMiddleware so static assets never trigger a DB lookup.
  app.use(express.static(webDist));
  logger.info({ webDist }, "Serving web app");
} else {
  logger.warn({ webDist }, "Web build not found — running in API-only mode");
}

app.use(authMiddleware);

app.use("/api", router);

// SPA fallback: any non-/api GET that didn't match a static file returns
// index.html so client-side (wouter) routes resolve on hard refresh / deep link.
if (serveWeb) {
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(webIndex);
  });
}

export default app;
