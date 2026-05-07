import { Router } from "express";
import {
  getAdminPass,
  safeCompare,
  createAdminSession,
  validateAdminSession,
  revokeAdminSession,
  checkAdminRateLimit,
} from "../lib/admin-sessions.js";

const router = Router();

function getClientIp(req: Parameters<Parameters<typeof router.post>[1]>[0]): string {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown"
  );
}

// POST /api/admin/login
// Validates the admin password and returns a short-lived session token.
// The raw password is NEVER stored in the browser after this call.
router.post("/admin/login", (req, res) => {
  const ip = getClientIp(req);

  if (!checkAdminRateLimit(ip)) {
    return res.status(429).json({ ok: false, error: "Too many attempts. Wait a minute." });
  }

  const adminPass = getAdminPass();
  if (!adminPass) {
    // Fail closed — do not leak whether a password exists
    return res.status(503).json({ ok: false, error: "Admin is not available" });
  }

  const { password } = (req.body ?? {}) as { password?: string };
  if (!password || typeof password !== "string") {
    return res.status(400).json({ ok: false, error: "Password required" });
  }

  if (!safeCompare(password, adminPass)) {
    return res.status(403).json({ ok: false, error: "Invalid credentials" });
  }

  const token = createAdminSession();
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  return res.json({ ok: true, token, expiresAt });
});

// POST /api/admin/logout
router.post("/admin/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) revokeAdminSession(token);
  return res.json({ ok: true });
});

// GET /api/admin/check
// Frontend uses this to verify the session token is still valid.
router.get("/admin/check", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !validateAdminSession(token)) {
    return res.status(401).json({ ok: false });
  }
  return res.json({ ok: true });
});

export default router;
