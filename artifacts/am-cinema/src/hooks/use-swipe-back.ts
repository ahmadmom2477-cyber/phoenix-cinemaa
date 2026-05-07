import { useEffect } from "react";

/**
 * Detects a swipe-right gesture starting from the left edge of the screen
 * and calls `onBack`. Mimics native iOS/Android back swipe behavior.
 */
export function useSwipeBack(onBack: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      // Must start within 40px of left edge, swipe ≥ 80px right, mostly horizontal
      if (startX < 40 && dx >= 80 && dy < dx * 0.6) {
        try { navigator.vibrate?.(30); } catch {}
        onBack();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [onBack, enabled]);
}
