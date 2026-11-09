import { useEffect, useState } from "react";
import { useMotionStore } from "./reducedMotion";

export function useCountUp(target: number, durationMs = 600): number {
  const [current, setCurrent] = useState<number>(target);
  const reducedMotion = useMotionStore((s) => s.reducedMotion);

  useEffect(() => {
    if (reducedMotion || durationMs <= 0) {
      setCurrent(target);
      return;
    }

    const startVal = current;
    const diff = target - startVal;
    if (diff === 0) return;

    let startTime: number | null = null;
    let rafId: number | null = null;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startVal + diff * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [target, durationMs, reducedMotion]);

  return current;
}
