import { useState, useEffect, useRef, useCallback } from "react";

interface UsePullToRefreshOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Distance in px needed to trigger refresh (default: 60)
  maxPull?: number;   // Maximum visual pull distance (default: 85)
}

export function usePullToRefresh({
  containerRef,
  onRefresh,
  threshold = 60,
  maxPull = 85,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  // Keep ref synchronized with state
  isRefreshingRef.current = isRefreshing;

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const container = containerRef.current;
      if (!container || isRefreshingRef.current) return;

      // Only allow pull gesture if at the very top of the scroll container
      if (container.scrollTop <= 0) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    },
    [containerRef]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const container = containerRef.current;
      if (!container || !isPullingRef.current || isRefreshingRef.current) return;

      if (container.scrollTop > 0) {
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const rawDelta = currentY - startYRef.current;

      if (rawDelta > 0) {
        // Cubic resistance calculation for a smooth, native iOS/Android feel
        const dampened = Math.min(Math.pow(rawDelta, 0.82) * 1.4, maxPull);
        setPullDistance(dampened);

        if (e.cancelable) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
      }
    },
    [containerRef, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || isRefreshingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.8); // Lock at subtle height while refreshing

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {}
      }

      try {
        await onRefresh();
      } catch (err) {
        console.error("Pull-to-refresh failed:", err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullDistance,
    isRefreshing,
    pullProgress: Math.min(pullDistance / threshold, 1),
  };
}
