import React from "react";
import { Shield, Sparkles } from "lucide-react";
import { useConsoleStore } from "./useConsoleStore";
import { useMotionStore } from "@/lib/motion/reducedMotion";

export const FooterChip: React.FC = () => {
  const { setLimitationsOpen } = useConsoleStore();
  const { reducedMotion, toggleReducedMotion } = useMotionStore();

  return (
    <footer className="h-8 border-t border-line bg-surface px-4 flex items-center justify-between text-[11px] font-mono text-ink-3 select-none z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLimitationsOpen(true)}
          className="hover:text-ink flex items-center gap-1.5 transition-colors underline decoration-dotted underline-offset-2"
        >
          <Shield className="w-3 h-3 text-copper" />
          <span>Evidence-bounded model · No exploits executed</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* Reduced motion toggle */}
        <button
          onClick={toggleReducedMotion}
          className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
            reducedMotion
              ? "bg-copper/10 text-copper border-copper/30 font-bold"
              : "hover:bg-surface-2 text-ink-3 border-transparent"
          }`}
          title="Toggle CSS motion and 3D effects"
        >
          Reduce motion: {reducedMotion ? "ON" : "OFF"}
        </button>

        <span>FutureForge Team Persona 4</span>
      </div>
    </footer>
  );
};
