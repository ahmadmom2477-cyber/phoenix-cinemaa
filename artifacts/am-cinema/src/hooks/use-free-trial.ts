import { useState, useEffect, useCallback, useRef } from "react";

export const FREE_WATCH_LIMIT = 3;

const EVENT = "phoenix:access-updated";

interface AccessStatus {
  isSubscribed: boolean;
  subscriptionExpiresAt: number | null;
  freePlaysLimit: number;
  freePlaysUsed: number;
  freePlaysRemaining: number;
  canWatch: boolean;
  trialId: string | null;
  reason: string | null;
}

// Module-level cache so multiple component instances share one fetch
let cachedStatus: AccessStatus | null = null;
let fetchPromise: Promise<void> | null = null;

function getSubToken(): string | null {
  try {
    const raw = localStorage.getItem("enawi_subscription_v2");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sessionToken?: string; expiresAt?: number };
    if (parsed.sessionToken && parsed.expiresAt && parsed.expiresAt > Date.now()) {
      return parsed.sessionToken;
    }
  } catch {}
  return null;
}

async function fetchAccessStatus(): Promise<AccessStatus> {
  const headers: Record<string, string> = {};
  const token = getSubToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("/api/access/status", { headers, credentials: "same-origin" });
  if (!res.ok) throw new Error("access status fetch failed");
  return res.json() as Promise<AccessStatus>;
}

export function useFreeTrial() {
  const [status, setStatus] = useState<AccessStatus | null>(cachedStatus);
  const fetchedRef = useRef(!!cachedStatus);

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<AccessStatus>).detail;
      cachedStatus = data;
      setStatus(data);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    if (!fetchPromise) {
      fetchPromise = fetchAccessStatus()
        .then((data) => {
          cachedStatus = data;
          setStatus(data);
          window.dispatchEvent(new CustomEvent(EVENT, { detail: data }));
        })
        .catch(() => {
          // Network failure: fall back to generous defaults (allow watching)
          const fallback: AccessStatus = {
            isSubscribed: false,
            subscriptionExpiresAt: null,
            freePlaysLimit: FREE_WATCH_LIMIT,
            freePlaysUsed: 0,
            freePlaysRemaining: FREE_WATCH_LIMIT,
            canWatch: true,
            trialId: null,
            reason: null,
          };
          cachedStatus = fallback;
          setStatus(fallback);
          window.dispatchEvent(new CustomEvent(EVENT, { detail: fallback }));
        })
        .finally(() => { fetchPromise = null; });
    } else {
      fetchPromise.then(() => {
        if (cachedStatus) setStatus(cachedStatus);
      });
    }
  }, []);

  const recordWatch = useCallback(async (
    _imdbId: string,
    playbackSessionId?: string,
  ): Promise<{ allowed: boolean; remaining: number }> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getSubToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch("/api/access/consume-play", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ playbackSessionId }),
      });

      const data = await res.json() as {
        consumed: boolean;
        freePlaysRemaining?: number | null;
        reason?: string;
        isSubscribed?: boolean;
      };

      if (data.consumed) {
        const remaining = data.freePlaysRemaining ?? (status ? status.freePlaysRemaining - 1 : 0);
        const used = status ? status.freePlaysUsed + 1 : 1;
        const newStatus: AccessStatus = {
          ...(status ?? {
            isSubscribed: false,
            subscriptionExpiresAt: null,
            freePlaysLimit: FREE_WATCH_LIMIT,
            trialId: null,
            reason: null,
          }),
          isSubscribed: data.isSubscribed ?? status?.isSubscribed ?? false,
          freePlaysRemaining: Math.max(0, remaining ?? 0),
          freePlaysUsed: used,
          canWatch: (data.freePlaysRemaining ?? (remaining ?? 1)) > 0 || (data.isSubscribed ?? false),
        };
        cachedStatus = newStatus;
        setStatus(newStatus);
        window.dispatchEvent(new CustomEvent(EVENT, { detail: newStatus }));
        return { allowed: true, remaining: Math.max(0, remaining ?? 0) };
      } else {
        const newStatus: AccessStatus = {
          ...(status ?? {
            isSubscribed: false,
            subscriptionExpiresAt: null,
            freePlaysLimit: FREE_WATCH_LIMIT,
            freePlaysUsed: FREE_WATCH_LIMIT,
            trialId: null,
            reason: "subscription_required",
          }),
          freePlaysRemaining: 0,
          canWatch: false,
        };
        cachedStatus = newStatus;
        setStatus(newStatus);
        window.dispatchEvent(new CustomEvent(EVENT, { detail: newStatus }));
        return { allowed: false, remaining: 0 };
      }
    } catch {
      // Network failure: allow watching without consuming
      return { allowed: true, remaining: status?.freePlaysRemaining ?? FREE_WATCH_LIMIT };
    }
  }, [status]);

  const remaining = status?.freePlaysRemaining ?? FREE_WATCH_LIMIT;
  const used = status?.freePlaysUsed ?? 0;

  return {
    remaining,
    used,
    limit: status?.freePlaysLimit ?? FREE_WATCH_LIMIT,
    isTrialActive: remaining > 0,
    isSubscribed: status?.isSubscribed ?? false,
    canWatch: status?.canWatch ?? true,
    isLoading: status === null,
    hasWatched: (_id: string) => false,
    recordWatch,
  };
}
