import { Router } from "express";
import crypto from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getAdminPass,
  getSubSecret,
  getPaymentUrl,
  safeCompare,
  validateAdminSession,
  checkAdminRateLimit,
} from "../lib/admin-sessions.js";

const router = Router();

const __dirnameLocal = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirnameLocal, "..", "data");
const GIFT_FILE = join(DATA_DIR, "gift-codes.json");
const MONTHLY_SESSION_FILE = join(DATA_DIR, "monthly-sessions.json");

interface GiftCode {
  createdAt: number;
  label: string;
  durationDays: number;
  maxUses: number;
  usedCount: number;
  usedAt: number | null;
  codeExpiresAt: number | null;
  activeTokens: string[];
}
type GiftStore = Record<string, GiftCode>;

interface MonthlySession {
  activatedAt: number;
  expiresAt: number;
}
type MonthlySessionStore = Record<string, MonthlySession>;

// ── Subscription validate rate limiting ──────────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_ATTEMPTS = 8;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap.entries()) {
    if (entry.resetAt < now) rateMap.delete(ip);
  }
}, 5 * 60_000).unref();

// ── Activation lock ──────────────────────────────────────────────────────────
const activationLocks = new Set<string>();

// ── Gift code store ──────────────────────────────────────────────────────────
function loadGifts(): GiftStore {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(GIFT_FILE)) { writeFileSync(GIFT_FILE, "{}"); return {}; }
    const raw = JSON.parse(readFileSync(GIFT_FILE, "utf-8")) as GiftStore;
    for (const entry of Object.values(raw)) {
      if (!Array.isArray(entry.activeTokens)) entry.activeTokens = [];
      if ("expiresAt" in entry && !("codeExpiresAt" in entry)) {
        (entry as GiftCode).codeExpiresAt = (entry as unknown as { expiresAt: number | null }).expiresAt;
      }
    }
    return raw;
  } catch { return {}; }
}

function saveGifts(store: GiftStore): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(GIFT_FILE, JSON.stringify(store, null, 2));
  } catch {}
}

// ── Monthly session store ────────────────────────────────────────────────────
function loadMonthlySessions(): MonthlySessionStore {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(MONTHLY_SESSION_FILE)) return {};
    const raw = JSON.parse(readFileSync(MONTHLY_SESSION_FILE, "utf-8")) as MonthlySessionStore;
    const now = Date.now();
    let changed = false;
    for (const [token, session] of Object.entries(raw)) {
      if (session.expiresAt < now) { delete raw[token]; changed = true; }
    }
    if (changed) writeMonthlySessions(raw);
    return raw;
  } catch { return {}; }
}

function writeMonthlySessions(store: MonthlySessionStore): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(MONTHLY_SESSION_FILE, JSON.stringify(store, null, 2));
  } catch {}
}

function addMonthlySession(token: string, expiresAt: number): void {
  const store = loadMonthlySessions();
  store[token] = { activatedAt: Date.now(), expiresAt };
  writeMonthlySessions(store);
}

function isMonthlySessionValid(token: string): boolean {
  const store = loadMonthlySessions();
  const session = store[token];
  return !!(session && session.expiresAt > Date.now());
}

// ── Gift code helpers ────────────────────────────────────────────────────────
function generateGiftCode(): string {
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `G-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function isCodeActive(entry: GiftCode): boolean {
  if (entry.codeExpiresAt && entry.codeExpiresAt < Date.now()) return false;
  if (entry.maxUses > 0 && entry.usedCount >= entry.maxUses) return false;
  return true;
}

// ── Monthly HMAC code ────────────────────────────────────────────────────────
// NOTE: HMAC key prefix kept as ENAWI-${year}-${month} to avoid invalidating
// existing subscriber codes already distributed.
function getMonthCode(secret: string, year: number, month: number): string {
  const key = `ENAWI-${year}-${String(month).padStart(2, "0")}`;
  return crypto.createHmac("sha256", secret).update(key).digest("hex").slice(0, 8).toUpperCase();
}
function formatCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
function isMonthlyCode(normalized: string, secret: string): boolean {
  const now = new Date();
  const checks = [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    {
      year: new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear(),
      month: new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth() + 1,
    },
  ];
  return checks.some(({ year, month }) => {
    const expected = getMonthCode(secret, year, month);
    return safeCompare(normalized, expected);
  });
}

// ── Admin auth helper ─────────────────────────────────────────────────────────
// Accepts Authorization: Bearer <admin_session_token> ONLY.
// Tokens are obtained via POST /api/admin/login (never stored raw in browser).
// If PHOENIX_ADMIN_PASS (or ENAWI_ADMIN_PASS) is not set, all admin endpoints
// return 503 so the API fails closed rather than open.

type Req = Parameters<Parameters<typeof router.get>[1]>[0];
type Res = Parameters<Parameters<typeof router.get>[1]>[1];

function checkAdmin(req: Req, res: Res): boolean {
  const adminPass = getAdminPass();
  if (!adminPass) {
    // Fail closed — safe error message, no leakage of env state
    res.status(503).json({ error: "Admin not available" });
    return false;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || !validateAdminSession(token)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }

  return true;
}

// ── Admin route rate limiting ─────────────────────────────────────────────────
function getClientIp(req: Req): string {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown"
  );
}

function adminRateGuard(req: Req, res: Res): boolean {
  if (!checkAdminRateLimit(getClientIp(req))) {
    res.status(429).json({ error: "Too many requests" });
    return false;
  }
  return true;
}

// ── Public: subscription info ────────────────────────────────────────────────
router.get("/subscription/info", (_req, res) => {
  res.json({
    enabled: !!getSubSecret(),
    price: "10",
    currency: "SAR",
    priceUsd: "2.67",
    paymentUrl: getPaymentUrl() || "",
  });
});

// ── Public: validate code ────────────────────────────────────────────────────
router.post("/subscription/validate", (req, res) => {
  const ip = getClientIp(req);

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ valid: false, error: "Too many attempts. Please wait a minute and try again." });
  }

  const secret = getSubSecret();
  if (!secret) {
    return res.json({ valid: true, expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, codeType: "monthly" });
  }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string") {
    return res.status(400).json({ valid: false, error: "Code required" });
  }

  const normalized = code.replace(/-/g, "").toUpperCase().trim();

  if (isMonthlyCode(normalized, secret)) {
    const sessionToken = crypto.randomBytes(20).toString("hex");
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    addMonthlySession(sessionToken, expiresAt);
    return res.json({ valid: true, expiresAt, sessionToken, codeType: "monthly" });
  }

  const key = code.toUpperCase().trim();

  if (activationLocks.has(key)) {
    return res.status(429).json({ valid: false, error: "Code is being activated, please try again in a moment" });
  }
  activationLocks.add(key);

  try {
    const store = loadGifts();
    const entry = store[key];

    if (!entry) {
      return res.status(401).json({ valid: false, error: "Invalid or expired code" });
    }

    if (entry.codeExpiresAt && entry.codeExpiresAt < Date.now()) {
      return res.status(401).json({ valid: false, error: "Code expired" });
    }

    if (entry.maxUses > 0 && entry.usedCount >= entry.maxUses) {
      return res.status(401).json({ valid: false, error: "Code already used" });
    }

    const sessionToken = crypto.randomBytes(20).toString("hex");

    if (entry.maxUses === 1) {
      entry.activeTokens = [sessionToken];
    } else {
      if (!Array.isArray(entry.activeTokens)) entry.activeTokens = [];
      entry.activeTokens.push(sessionToken);
    }

    entry.usedCount = (entry.usedCount ?? 0) + 1;
    if (!entry.usedAt) entry.usedAt = Date.now();
    saveGifts(store);

    const durationMs = (entry.durationDays ?? 30) * 24 * 60 * 60 * 1000;
    return res.json({ valid: true, expiresAt: Date.now() + durationMs, sessionToken, codeType: "gift" });
  } finally {
    activationLocks.delete(key);
  }
});

// ── Public: verify session token ─────────────────────────────────────────────
router.post("/subscription/check-token", (req, res) => {
  const { sessionToken } = req.body as { sessionToken?: string };
  if (!sessionToken || typeof sessionToken !== "string") {
    return res.json({ valid: false });
  }

  if (isMonthlySessionValid(sessionToken)) {
    return res.json({ valid: true });
  }

  const store = loadGifts();
  for (const entry of Object.values(store)) {
    if (Array.isArray(entry.activeTokens) && entry.activeTokens.includes(sessionToken)) {
      return res.json({ valid: true });
    }
  }
  return res.json({ valid: false });
});

// ── Admin: get monthly code ───────────────────────────────────────────────────
router.get("/subscription/admin-code", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const secret = getSubSecret();
  if (!secret) return res.status(503).json({ error: "PHOENIX_SUB_SECRET not configured" });
  const now = new Date();
  const raw = getMonthCode(secret, now.getFullYear(), now.getMonth() + 1);
  return res.json({
    code: formatCode(raw),
    month: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
    activeSessions: Object.keys(loadMonthlySessions()).length,
  });
});

// ── Admin: revoke all monthly sessions ───────────────────────────────────────
router.post("/subscription/monthly-sessions/revoke", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const store = loadMonthlySessions();
  const count = Object.keys(store).length;
  writeMonthlySessions({});
  return res.json({ revoked: count });
});

// ── Admin: list gift codes ────────────────────────────────────────────────────
router.get("/subscription/gifts", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const store = loadGifts();
  const list = Object.entries(store).map(([code, data]) => ({
    code,
    label: data.label,
    createdAt: data.createdAt,
    usedAt: data.usedAt,
    codeExpiresAt: data.codeExpiresAt ?? null,
    durationDays: data.durationDays ?? 30,
    maxUses: data.maxUses ?? 1,
    usedCount: data.usedCount ?? 0,
    activeSessions: (data.activeTokens ?? []).length,
    active: isCodeActive(data),
  }));
  list.sort((a, b) => b.createdAt - a.createdAt);
  return res.json({ codes: list, total: list.length, active: list.filter((c) => c.active).length });
});

// ── Admin: generate gift code(s) ─────────────────────────────────────────────
router.post("/subscription/gifts/generate", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const {
    label = "",
    count = 1,
    durationDays = 30,
    maxUses = 1,
    codeExpiresAt = null,
  } = req.body as { label?: string; count?: number; durationDays?: number; maxUses?: number; codeExpiresAt?: number | null };

  const n = Math.min(Math.max(1, Number(count) || 1), 50);
  const duration = Math.max(1, Number(durationDays) || 30);
  const uses = Math.max(0, Number(maxUses) ?? 1);
  const expiry = codeExpiresAt ? Number(codeExpiresAt) : null;

  const store = loadGifts();
  const generated: string[] = [];
  for (let i = 0; i < n; i++) {
    const code = generateGiftCode();
    store[code] = {
      createdAt: Date.now(),
      label: label || "",
      durationDays: duration,
      maxUses: uses,
      usedCount: 0,
      usedAt: null,
      codeExpiresAt: expiry,
      activeTokens: [],
    };
    generated.push(code);
  }
  saveGifts(store);
  return res.json({ generated, count: generated.length });
});

// ── Admin: revoke all sessions for a code ────────────────────────────────────
router.post("/subscription/gifts/:code/revoke-sessions", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const code = req.params["code"]?.toUpperCase().trim();
  const store = loadGifts();
  if (!store[code]) return res.status(404).json({ error: "Code not found" });
  const count = (store[code].activeTokens ?? []).length;
  store[code].activeTokens = [];
  saveGifts(store);
  return res.json({ revoked: count });
});

// ── Admin: delete gift code ───────────────────────────────────────────────────
router.delete("/subscription/gifts/:code", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const code = req.params["code"]?.toUpperCase().trim();
  const store = loadGifts();
  if (!store[code]) return res.status(404).json({ error: "Code not found" });
  delete store[code];
  saveGifts(store);
  return res.json({ deleted: code });
});

// ── Named subscriber registry ─────────────────────────────────────────────────
interface Subscriber { id: string; name: string; startDate: number; endDate: number; notes?: string }
type SubscriberStore = Record<string, Subscriber>;
const SUBSCRIBER_FILE = join(DATA_DIR, "subscribers.json");

function loadSubscribers(): SubscriberStore {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(SUBSCRIBER_FILE)) return {};
    return JSON.parse(readFileSync(SUBSCRIBER_FILE, "utf-8")) as SubscriberStore;
  } catch { return {}; }
}
function saveSubscribers(store: SubscriberStore): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SUBSCRIBER_FILE, JSON.stringify(store, null, 2));
  } catch {}
}

router.get("/subscription/subscribers", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const store = loadSubscribers();
  const now = Date.now();
  const list = Object.values(store).sort((a, b) => b.startDate - a.startDate);
  return res.json({ subscribers: list, total: list.length, active: list.filter((s) => s.endDate > now).length });
});

router.post("/subscription/subscribers", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const { name, durationDays, notes, startDate } = req.body as { name?: string; durationDays?: number; notes?: string; startDate?: number };
  if (!name?.trim() || !durationDays) return res.status(400).json({ error: "Missing name or durationDays" });
  const start = startDate ? Number(startDate) : Date.now();
  const end = start + Number(durationDays) * 24 * 60 * 60 * 1000;
  const id = crypto.randomUUID();
  const store = loadSubscribers();
  store[id] = { id, name: name.trim(), startDate: start, endDate: end, notes: notes?.trim() || "" };
  saveSubscribers(store);
  return res.json(store[id]);
});

router.patch("/subscription/subscribers/:id", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const id = req.params["id"]!;
  const store = loadSubscribers();
  if (!store[id]) return res.status(404).json({ error: "Not found" });
  const { name, durationDays, notes, startDate } = req.body as { name?: string; durationDays?: number; notes?: string; startDate?: number };
  if (name) store[id].name = name.trim();
  if (notes !== undefined) store[id].notes = notes.trim();
  if (startDate) store[id].startDate = Number(startDate);
  if (durationDays) store[id].endDate = store[id].startDate + Number(durationDays) * 24 * 60 * 60 * 1000;
  saveSubscribers(store);
  return res.json(store[id]);
});

router.delete("/subscription/subscribers/:id", (req, res) => {
  if (!adminRateGuard(req, res)) return;
  if (!checkAdmin(req, res)) return;
  const id = req.params["id"]!;
  const store = loadSubscribers();
  if (!store[id]) return res.status(404).json({ error: "Not found" });
  delete store[id];
  saveSubscribers(store);
  return res.json({ deleted: id });
});

export default router;
