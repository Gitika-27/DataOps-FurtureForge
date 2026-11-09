import React from "react";
import { Sparkles, ArrowRight, ArrowLeft, X, Check, ShieldCheck } from "lucide-react";
import { useConsoleStore } from "./useConsoleStore";
import { useNavigate } from "react-router-dom";

export const GuidedDemoOverlay: React.FC = () => {
  const {
    guidedDemoStep,
    setGuidedDemoStep,
    setMode,
    setLab,
    selectAsset,
    setActiveInspectorTab,
    setIsVerifiedPlanShown,
    setLimitationsOpen,
  } = useConsoleStore();

  const navigate = useNavigate();

  if (guidedDemoStep === null) return null;

  const steps = [
    {
      step: 1,
      title: "Step 1: Synthetic Demo Selection",
      desc: "We start by selecting the Synthetic Demo fixture. This fixture uses fabricated CVE-2099-* IDs to demonstrate the complete graph, optimizer, and independent verifier without external network dependencies.",
      actionLabel: "Next: Review Assets",
      onExecute: () => {
        setLab("lab_a");
        setMode("demo");
      },
    },
    {
      step: 2,
      title: "Step 2: Scanned Asset Topology",
      desc: "Assets are organized across 3 depth zones: Internet (outer), DMZ (middle), and Internal Core. In Lab A, web01 is the public entry point, and db01 (MariaDB) is the crown jewel.",
      actionLabel: "Next: Inspect Skeptic",
      onExecute: () => {
        selectAsset("app01");
      },
    },
    {
      step: 3,
      title: "Step 3: Deterministic Skeptic Verdicts",
      desc: "Unlike standard scanners that report every raw CVE, the Skeptic reviews evidence against observed service versions and reachability. Ambiguous port 0 image findings are downgraded.",
      actionLabel: "Next: Attack Path",
      onExecute: () => {
        setActiveInspectorTab("skeptic");
      },
    },
    {
      step: 4,
      title: "Step 4: Evidence-Bounded Attack Graph",
      desc: "Notice the red flowing attack path on the dark specimen stage: web01 → app01 → db01. An edge exists ONLY when a confirmed, remotely exploitable finding is reachable on that port.",
      actionLabel: "Next: Run Optimizer",
      onExecute: () => {
        setActiveInspectorTab("plan");
      },
    },
    {
      step: 5,
      title: "Step 5: Cost-Aware Min-Cut Solver",
      desc: "Rather than patching all 6 raw findings (cost $14+), the binary optimizer identifies the critical path bottleneck: applying 'demo-db-fix' (cost $1) on db01 cuts all paths to the crown jewel.",
      actionLabel: "Next: Show Verified Cut",
      onExecute: () => {
        setIsVerifiedPlanShown(true);
      },
    },
    {
      step: 6,
      title: "Step 6: Independent Backend Verification",
      desc: "The plan is not merely assumed to work: the backend applies patches to a graph copy and recounts paths. Modeled attack paths drop from 1 to 0. Status: VERIFIED.",
      actionLabel: "Next: Audit Ledger",
      onExecute: () => {
        setIsVerifiedPlanShown(true);
        setActiveInspectorTab("plan");
      },
    },
    {
      step: 7,
      title: "Step 7: Full Audit Evidence Ledger",
      desc: "Every step is logged in an escaped, auditable HTML report and one-page PDF, preserving full mathematical evidence for security architects and compliance officers.",
      actionLabel: "Next: Model Boundaries",
      onExecute: () => {
        // Can open report or stay in console
      },
    },
    {
      step: 8,
      title: "Step 8: Honest Model Boundaries",
      desc: "FutureForge is honest by design: 'verified' means verified against the modeled graph, not 100% immune from zero-days. Missing evidence means missing paths. No exploits are executed.",
      actionLabel: "Finish Demo",
      onExecute: () => {
        setLimitationsOpen(true);
      },
    },
  ];

  const current = steps[guidedDemoStep - 1] || steps[0];

  const handleNext = () => {
    current.onExecute();
    if (guidedDemoStep < steps.length) {
      setGuidedDemoStep(guidedDemoStep + 1);
    } else {
      setGuidedDemoStep(null);
    }
  };

  const handlePrev = () => {
    if (guidedDemoStep > 1) {
      setGuidedDemoStep(guidedDemoStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-center p-6 bg-black/40 backdrop-blur-[2px]">
      <div className="pointer-events-auto bg-surface border border-line rounded-2xl p-5 shadow-deep max-w-lg w-full space-y-3.5 animate-unfold-top">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-copper/10 text-copper flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-copper font-bold block">
                Guided Tour ({guidedDemoStep} of {steps.length})
              </span>
              <h4 className="font-serif font-bold text-ink text-base">
                {current.title}
              </h4>
            </div>
          </div>

          <button
            onClick={() => setGuidedDemoStep(null)}
            className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
            title="Exit guided tour (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <p className="text-xs font-mono text-ink-2 leading-relaxed">
          {current.desc}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <button
            onClick={handlePrev}
            disabled={guidedDemoStep === 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-ink-2 hover:text-ink disabled:opacity-30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-ink text-paper hover:bg-ink/90 active:scale-95 transition-all shadow-subtle"
          >
            <span>{current.actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
