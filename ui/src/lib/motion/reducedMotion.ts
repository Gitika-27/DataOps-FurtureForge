import { create } from "zustand";

interface MotionState {
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
  setReducedMotion: (val: boolean) => void;
}

const getInitialReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("futureforge_reduced_motion");
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export const useMotionStore = create<MotionState>((set) => ({
  reducedMotion: getInitialReducedMotion(),
  toggleReducedMotion: () => {
    set((state) => {
      const next = !state.reducedMotion;
      localStorage.setItem("futureforge_reduced_motion", String(next));
      if (typeof document !== "undefined") {
        if (next) {
          document.documentElement.setAttribute("data-motion", "reduced");
        } else {
          document.documentElement.removeAttribute("data-motion");
        }
      }
      return { reducedMotion: next };
    });
  },
  setReducedMotion: (val: boolean) => {
    localStorage.setItem("futureforge_reduced_motion", String(val));
    if (typeof document !== "undefined") {
      if (val) {
        document.documentElement.setAttribute("data-motion", "reduced");
      } else {
        document.documentElement.removeAttribute("data-motion");
      }
    }
    set({ reducedMotion: val });
  },
}));

// Initialize document attribute on load
if (typeof document !== "undefined") {
  const init = getInitialReducedMotion();
  if (init) {
    document.documentElement.setAttribute("data-motion", "reduced");
  }
}
