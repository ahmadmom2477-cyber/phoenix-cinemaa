import { Router } from "express";
import {
  getOrCreateTrialSession,
  getTrialInfo,
  consumeTrialPlay,
  checkSubscriptionToken,
} from "../lib/session-store.js";

const router = Router();

const COOKIE_NAME = "pc_trial";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

function cookieOpts(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  };
}

function extractToken(authHeader: string | undefined): string | null {
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

// GET /api/access/status
router.get("/access/status", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const token = extractToken(req.headers.authorization);

  let isSubscribed = false;
  let subscriptionExpiresAt: number | null = null;

  if (token) {
    const sub = checkSubscriptionToken(token);
    if (sub.valid) {
      isSubscribed = true;
      subscriptionExpiresAt = sub.expiresAt ?? null;
    }
  }

  const trialId = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  const trial = getTrialInfo(trialId);

  if (!trialId || trialId !== trial.trialId) {
    res.cookie(COOKIE_NAME, trial.trialId, cookieOpts(isProd));
  }

  const canWatch = isSubscribed || trial.freePlaysRemaining > 0;

  return res.json({
    isSubscribed,
    subscriptionExpiresAt,
    freePlaysLimit: trial.freePlaysLimit,
    freePlaysUsed: trial.freePlaysUsed,
    freePlaysRemaining: trial.freePlaysRemaining,
    canWatch,
    trialId: trial.trialId,
    reason: canWatch ? null : "subscription_required",
  });
});

// POST /api/access/consume-play
router.post("/access/consume-play", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const token = extractToken(req.headers.authorization);

  if (token) {
    const sub = checkSubscriptionToken(token);
    if (sub.valid) {
      return res.json({ consumed: true, reason: "subscribed", freePlaysRemaining: null, isSubscribed: true });
    }
  }

  let trialId = (req.cookies as Record<string, string>)?.[COOKIE_NAME];

  if (!trialId) {
    const session = getOrCreateTrialSession(undefined);
    trialId = session.trialId;
    res.cookie(COOKIE_NAME, trialId, cookieOpts(isProd));
  }

  const { playbackSessionId } = (req.body ?? {}) as { playbackSessionId?: string };
  const result = consumeTrialPlay(trialId, playbackSessionId);

  if (!result.consumed) {
    return res.status(402).json({
      consumed: false,
      reason: result.reason,
      freePlaysRemaining: result.freePlaysRemaining,
      message: "انتهت مشاهداتك المجانية، اشترك للمتابعة",
    });
  }

  return res.json({
    consumed: true,
    freePlaysRemaining: result.freePlaysRemaining,
    isSubscribed: false,
  });
});

export default router;
