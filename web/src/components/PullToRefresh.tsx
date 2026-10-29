"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

type PullToRefreshProps = {
  children: React.ReactNode;
  threshold?: number;
  maxPull?: number;
  cooldownMs?: number;
};

export default function PullToRefresh({
  children,
  threshold = 64,
  maxPull = 120,
  cooldownMs = 1500,
}: PullToRefreshProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const lastTriggerRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pullActivationThreshold = 10;

  const triggerRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerRef.current < cooldownMs) return;
    lastTriggerRef.current = now;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app:refresh"));
    }
    startTransition(() => {
      router.refresh();
    });
  }, [cooldownMs, router]);

  const reset = useCallback(() => {
    startYRef.current = null;
    setIsPulling(false);
    setPullDistance(0);
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === "undefined") return;
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop > 0) return;
    startYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (typeof window === "undefined") return;
      if (startYRef.current === null) return;
      const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
      if (scrollTop > 0) {
        reset();
        return;
      }
      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;
      if (delta <= 0) {
        setPullDistance(0);
        setIsPulling(false);
        return;
      }
      if (delta < pullActivationThreshold && !isPulling) {
        setPullDistance(0);
        return;
      }
      if (!isPulling) {
        setIsPulling(true);
      }
      event.preventDefault();
      setPullDistance(Math.min(delta, maxPull));
    },
    [isPulling, maxPull, reset],
  );

  const handleTouchEnd = useCallback(() => {
    if (startYRef.current === null) return;
    const shouldTrigger = pullDistance >= threshold;
    reset();
    if (!shouldTrigger) return;
    triggerRefresh();
  }, [pullDistance, reset, threshold, triggerRefresh]);

  const showIndicator = isPulling || isPending;
  const contentOffset = showIndicator ? Math.min(pullDistance / 2, 36) : 0;

  return (
    <div
      ref={containerRef}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className={showIndicator ? "pt-10" : undefined}
        style={{
          transform: `translateY(${contentOffset}px)`,
          transition: isPulling ? "none" : "transform 200ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
