import type { Request, Response, NextFunction } from "express";
import { getTrialInfo, checkSubscriptionToken } from "../lib/session-store.js";

const COOKIE_NAME = "pc_trial";

export function requireAccess(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    const sub = checkSubscriptionToken(token);
    if (sub.valid) { next(); return; }
  }

  const trialId = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  const trial = getTrialInfo(trialId);

  if (trial.freePlaysRemaining > 0) { next(); return; }

  res.status(402).json({
    error: "access_required",
    message: "انتهت مشاهداتك المجانية، اشترك للمتابعة",
    code: "SUBSCRIPTION_REQUIRED",
  });
}
