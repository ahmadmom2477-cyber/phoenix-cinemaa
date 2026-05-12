import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { join } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first proxy (required for Render / reverse-proxy deployments).
// This makes req.ip and secure cookie detection work correctly behind HTTPS.
app.set("trust proxy", 1);

// ── Security headers (helmet) ─────────────────────────────────────────────────
// Applied before everything else so every response gets security headers.
// Content-Security-Policy is relaxed to allow the video player iframes.
app.use(
  helmet({
    contentSecurityPolicy: false, // CSP managed per-route or by frontend
    crossOriginEmbedderPolicy: false, // needed for video iframes
  }),
);

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Request logging ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0], // strip query params from logs
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Development: allow all origins (Replit preview iframe)
// Production:  frontend is served from the same Express server (same origin),
//              so no CORS needed. Optionally allow an extra origin via
//              PHOENIX_FRONTEND_URL if you ever split services in the future.
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: true, credentials: true }));
} else {
  const extraOrigin =
    process.env["PHOENIX_FRONTEND_URL"] ?? process.env["FRONTEND_URL"];
  if (extraOrigin) {
    app.use(cors({ origin: [extraOrigin], credentials: true }));
  }
  // No CORS middleware when frontend is on same origin — browser handles it.
}

// ── Parsers ──────────────────────────────────────────────────────────────────
app.use(cookieParser());

// Limit request body sizes to prevent abuse
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Static frontend (production only) ────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const frontendPath = join(__dirname, "../../am-cinema/dist/public");
  if (existsSync(frontendPath)) {
    app.use(
      express.static(frontendPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders(res, filePath) {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          }
        },
      }),
    );
    app.get("/{*path}", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(join(frontendPath, "index.html"));
    });
  }
}

export default app;
