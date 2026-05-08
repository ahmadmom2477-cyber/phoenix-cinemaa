import crypto from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirLocal = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirLocal, "..", "data");

// ── Trial sessions ────────────────────────────────────────────────────────────

const TRIAL_FILE = join(DATA_DIR, "trial-sessions.json");
export const FREE_PLAYS_LIMIT = 3;
const IDEMPOTENCY_WINDOW_MS = 30_000; // 30 seconds

interface TrialSession {
  trialId: string;
  createdAt: number;
  freePlaysUsed: number;
  lastPlayAt: number | null;
  lastPlaybackSessionId: string | null;
}

type TrialStore = Record<string, TrialSession>;

let trialStore: TrialStore = {};

function loadTrialStore(): TrialStore {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(TRIAL_FILE)) return {};
    return JSON.parse(readFileSync(TRIAL_FILE, "utf-8")) as TrialStore;
  } catch {
    return {};
  }
}

function saveTrialStore(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(TRIAL_FILE, JSON.stringify(trialStore, null, 2));
  } catch {}
}

trialStore = loadTrialStore();

export function getOrCreateTrialSession(trialId: string | undefined): TrialSession {
  if (trialId && trialStore[trialId]) return trialStore[trialId];
  const id = crypto.randomUUID();
  const session: TrialSession = {
    trialId: id,
    createdAt: Date.now(),
    freePlaysUsed: 0,
    lastPlayAt: null,
    lastPlaybackSessionId: null,
  };
  trialStore[id] = session;
  setImmediate(() => saveTrialStore());
  return session;
}

export function getTrialInfo(trialId: string | undefined): {
  trialId: string;
  freePlaysLimit: number;
  freePlaysUsed: number;
  freePlaysRemaining: number;
  canWatch: boolean;
} {
  const session = trialId ? trialStore[trialId] : undefined;
  const target = session ?? getOrCreateTrialSession(undefined);
  const remaining = Math.max(0, FREE_PLAYS_LIMIT - target.freePlaysUsed);
  return {
    trialId: target.trialId,
    freePlaysLimit: FREE_PLAYS_LIMIT,
    freePlaysUsed: target.freePlaysUsed,
    freePlaysRemaining: remaining,
    canWatch: remaining > 0,
  };
}

export function consumeTrialPlay(
  trialId: string,
  playbackSessionId?: string,
): { consumed: boolean; reason?: string; freePlaysRemaining: number } {
  const session = trialStore[trialId];
  if (!session) {
    return { consumed: false, reason: "session_not_found", freePlaysRemaining: 0 };
  }

  // Idempotency: same playbackSessionId within the window = don't double-count
  if (playbackSessionId && session.lastPlaybackSessionId === playbackSessionId) {
    const timeSinceLast = session.lastPlayAt ? Date.now() - session.lastPlayAt : Infinity;
    if (timeSinceLast < IDEMPOTENCY_WINDOW_MS) {
      const remaining = Math.max(0, FREE_PLAYS_LIMIT - session.freePlaysUsed);
      return { consumed: true, freePlaysRemaining: remaining };
    }
  }

  if (session.freePlaysUsed >= FREE_PLAYS_LIMIT) {
    return { consumed: false, reason: "trial_exhausted", freePlaysRemaining: 0 };
  }

  session.freePlaysUsed += 1;
  session.lastPlayAt = Date.now();
  session.lastPlaybackSessionId = playbackSessionId ?? null;
  setImmediate(() => saveTrialStore());

  const remaining = Math.max(0, FREE_PLAYS_LIMIT - session.freePlaysUsed);
  return { consumed: true, freePlaysRemaining: remaining };
}

// ── Subscription token check ──────────────────────────────────────────────────

const MONTHLY_SESSION_FILE = join(DATA_DIR, "monthly-sessions.json");
const GIFT_FILE = join(DATA_DIR, "gift-codes.json");

interface MonthlySession {
  activatedAt: number;
  expiresAt: number;
}

interface GiftCode {
  activeTokens?: string[];
  [key: string]: unknown;
}

export function checkSubscriptionToken(token: string): { valid: boolean; expiresAt?: number } {
  if (!token) return { valid: false };

  // Check monthly sessions
  try {
    if (existsSync(MONTHLY_SESSION_FILE)) {
      const store = JSON.parse(
        readFileSync(MONTHLY_SESSION_FILE, "utf-8"),
      ) as Record<string, MonthlySession>;
      const session = store[token];
      if (session && session.expiresAt > Date.now()) {
        return { valid: true, expiresAt: session.expiresAt };
      }
    }
  } catch {}

  // Check gift code sessions
  try {
    if (existsSync(GIFT_FILE)) {
      const store = JSON.parse(readFileSync(GIFT_FILE, "utf-8")) as Record<string, GiftCode>;
      for (const entry of Object.values(store)) {
        if (Array.isArray(entry.activeTokens) && entry.activeTokens.includes(token)) {
          return { valid: true };
        }
      }
    }
  } catch {}

  return { valid: false };
}
