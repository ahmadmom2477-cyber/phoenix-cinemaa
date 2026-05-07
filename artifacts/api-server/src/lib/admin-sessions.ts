import crypto from "crypto";
import { timingSafeEqual } from "crypto";

// ── Environment helpers ────────────────────────────────────────────────────────
// Support PHOENIX_* (primary) with ENAWI_* as backward-compat fallback

export function getAdminPass(): string | undefined {
  return process.env["PHOENIX_ADMIN_PASS"] ?? process.env["ENAWI_ADMIN_PASS"];
}

export function getSubSecret(): string | undefined {
  return process.env["PHOENIX_SUB_SECRET"] ?? process.env["ENAWI_SUB_SECRET"];
}

export function getPaymentUrl(): string | undefined {
  return process.env["PHOENIX_PAYMENT_URL"] ?? process.env["ENAWI_PAYMENT_URL"];
}

// ── Constant-time password comparison ─────────────────────────────────────────

export function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "utf-8");
    const bBuf = Buffer.from(b, "utf-8");
    if (aBuf.length !== bBuf.length) {
      // Still do a comparison to prevent timing leaks on length
      timingSafeEqual(aBuf, aBuf);
      return false;
    }
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// ── In-memory admin session store ────────────────────────────────────────────
// Admin sessions intentionally reset on server restart — admins re-login.
// Tokens are 32-byte random hex strings, valid for 4 hours.

const ADMIN_SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface AdminSession {
  token: string;
  expiresAt: number;
}

const adminSessionStore = new Map<string, AdminSession>();

// Clean up expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of adminSessionStore.entries()) {
    if (session.expiresAt < now) adminSessionStore.delete(token);
  }
}, 10 * 60_000).unref();

export function createAdminSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  adminSessionStore.set(token, { token, expiresAt: Date.now() + ADMIN_SESSION_TTL });
  return token;
}

export function validateAdminSession(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const session = adminSessionStore.get(token);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    adminSessionStore.delete(token);
    return false;
  }
  return true;
}

export function revokeAdminSession(token: string): void {
  adminSessionStore.delete(token);
}

// ── Admin login rate limiting ──────────────────────────────────────────────────
const ADMIN_RATE_WINDOW_MS = 60_000;
const ADMIN_RATE_MAX = 5; // max 5 login attempts per minute

const adminRateMap = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of adminRateMap.entries()) {
    if (entry.resetAt < now) adminRateMap.delete(ip);
  }
}, 5 * 60_000).unref();

export function checkAdminRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = adminRateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    adminRateMap.set(ip, { count: 1, resetAt: now + ADMIN_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= ADMIN_RATE_MAX) return false;
  entry.count++;
  return true;
}
