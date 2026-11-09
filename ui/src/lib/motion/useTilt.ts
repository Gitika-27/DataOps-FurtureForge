import { useEffect, useRef } from "react";
import { useMotionStore } from "./reducedMotion";

export function useTilt<T extends HTMLElement = HTMLDivElement>(maxTiltDeg = 3) {
  const ref = useRef<T | null>(null);
  const reducedMotion = useMotionStore((s) => s.reducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;

    let rafId: number | null = null;

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -maxTiltDeg;
        const rotateY = ((x - centerX) / centerX) * maxTiltDeg;

        el.style.setProperty("--mouse-x", `${x}px`);
        el.style.setProperty("--mouse-y", `${y}px`);
        el.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
      });
    };

    const onPointerLeave = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
      el.style.removeProperty("--mouse-x");
      el.style.removeProperty("--mouse-y");
    };

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerleave", onPointerLeave);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.style.transform = "";
    };
  }, [reducedMotion, maxTiltDeg]);

  return ref;
}
