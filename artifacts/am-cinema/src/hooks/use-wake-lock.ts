import { useEffect, useRef } from "react";

export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
      return;
    }

    if (!("wakeLock" in navigator)) return;

    const acquire = async () => {
      try {
        lockRef.current = await (navigator as Navigator & {
          wakeLock: { request: (type: string) => Promise<WakeLockSentinel> };
        }).wakeLock.request("screen");
      } catch {
        // Device may not support it or permission denied — silent fail
      }
    };

    acquire();

    // Re-acquire when page becomes visible again (e.g. after switching tabs)
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [enabled]);
}
