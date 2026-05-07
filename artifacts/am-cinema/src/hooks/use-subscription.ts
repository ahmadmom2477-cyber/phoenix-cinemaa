import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "enawi_subscription_v2";

interface StoredSub {
  expiresAt: number;
  activatedAt: number;
  sessionToken?: string;
  codeType?: "monthly" | "gift";
}

function getStored(): StoredSub | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSub;
    if (parsed.expiresAt > Date.now()) return parsed;
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

function storeSub(expiresAt: number, sessionToken?: string, codeType?: "monthly" | "gift") {
  const data: StoredSub = { expiresAt, activatedAt: Date.now(), sessionToken, codeType };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export interface SubscriptionInfo {
  enabled: boolean;
  price: string;
  currency: string;
  priceUsd: string;
  paymentUrl: string;
}

export function useSubscription() {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const sessionCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const deactivate = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(false);
    setExpiresAt(null);
    if (sessionCheckTimer.current) clearInterval(sessionCheckTimer.current);
  }, []);

  // Periodically verify gift-code session token (every 5 min)
  const startSessionCheck = useCallback((token: string) => {
    if (sessionCheckTimer.current) clearInterval(sessionCheckTimer.current);
    const check = async () => {
      try {
        const res = await fetch("/api/subscription/check-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: token }),
        });
        const data = await res.json() as { valid: boolean };
        if (!data.valid) {
          deactivate();
          // Notify user their session was taken over
          window.dispatchEvent(new CustomEvent("enawi:session-invalidated"));
        }
      } catch {
        // Network error — don't deactivate, try again later
      }
    };
    // Check once after 10 seconds, then every 5 minutes
    setTimeout(check, 10_000);
    sessionCheckTimer.current = setInterval(check, 5 * 60 * 1000);
  }, [deactivate]);

  useEffect(() => {
    const stored = getStored();

    fetch("/api/subscription/info")
      .then((r) => r.json())
      .then((data: SubscriptionInfo) => {
        setInfo(data);
        if (!data.enabled) {
          setIsActive(true);
        } else {
          setIsActive(!!stored);
          if (stored) {
            setExpiresAt(stored.expiresAt);
            // Start session check only for gift codes with a token
            if (stored.codeType === "gift" && stored.sessionToken) {
              startSessionCheck(stored.sessionToken);
            }
          }
        }
      })
      .catch(() => {
        setInfo(null);
        setIsActive(!!stored);
        if (stored) setExpiresAt(stored.expiresAt);
      });

    return () => {
      if (sessionCheckTimer.current) clearInterval(sessionCheckTimer.current);
    };
  }, [startSessionCheck]);

  const activate = useCallback(async (code: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/subscription/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as {
        valid: boolean;
        expiresAt?: number;
        error?: string;
        sessionToken?: string;
        codeType?: "monthly" | "gift";
      };
      if (data.valid && data.expiresAt) {
        storeSub(data.expiresAt, data.sessionToken, data.codeType);
        setExpiresAt(data.expiresAt);
        // Start periodic session check for gift codes
        if (data.codeType === "gift" && data.sessionToken) {
          startSessionCheck(data.sessionToken);
        }
        return { ok: true };
      }
      return { ok: false, error: data.error ?? "Invalid code" };
    } catch {
      return { ok: false, error: "Connection error" };
    }
  }, [startSessionCheck]);

  return { isActive, info, expiresAt, activate, deactivate };
}
