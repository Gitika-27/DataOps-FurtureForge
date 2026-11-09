import React from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Layers,
  FileText,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Sparkles,
  Keyboard,
} from "lucide-react";
import { useConsoleStore } from "./useConsoleStore";
import { executeRunApi } from "@/api/client";

export const TopBar: React.FC = () => {
  const {
    lab,
    mode,
    bundle,
    loading,
    setLab,
    setMode,
    setBundle,
    setLoading,
    setError,
    setLimitationsOpen,
    setGuidedDemoStep,
    setKeyboardShortcutsOpen,
  } = useConsoleStore();

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await executeRunApi(lab, mode);
      setBundle(result);
    } catch (err: any) {
      setError(err.message || "Failed to execute engine run");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-line text-ink-2 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-copper" />
          ANALYZING
        </span>
      );
    }
    if (!bundle) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-surface-2 text-ink-3">
          AWAITING RUN
        </span>
      );
    }
    if (bundle.status === "verified") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-verified/10 text-verified border border-verified/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          VERIFIED
        </span>
      );
    }
    if (bundle.status === "no_modeled_paths") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-caution/10 text-caution border border-caution/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          NO MODELED PATHS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-threat/10 text-threat border border-threat/30">
        <ShieldAlert className="w-3.5 h-3.5" />
        INVALID
      </span>
    );
  };

  return (
    <header className="h-14 border-b border-line bg-surface px-4 flex items-center justify-between select-none z-30 relative">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-ink text-paper flex items-center justify-center font-serif text-lg font-bold shadow-subtle group-hover:bg-copper transition-colors">
            F
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif font-bold text-lg leading-tight tracking-tight text-ink">
                FutureForge
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase bg-surface-2 px-1.5 py-0.5 rounded text-ink-2 font-medium">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-ink-3 font-mono leading-none -mt-0.5">
              Patch Min-Cut Planner
            </p>
          </div>
        </Link>

        <div className="h-5 w-px bg-line" />

        {/* Lab Selector */}
        <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-line text-xs font-mono">
          <button
            onClick={() => setLab("lab_a")}
            title="Lab A: 3-tier segmented architecture (Internet, DMZ, Internal) with DB crown jewel"
            className={`px-2.5 py-1 rounded-md transition-all ${
              lab === "lab_a"
                ? "bg-surface text-ink font-semibold shadow-subtle"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            LAB A
          </button>
          <button
            onClick={() => {
              setLab("lab_b");
              if (mode === "demo") setMode("mock");
            }}
            title="Lab B: Alternative DMZ jumpbox & isolated network topology"
            className={`px-2.5 py-1 rounded-md transition-all ${
              lab === "lab_b"
                ? "bg-surface text-ink font-semibold shadow-subtle"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            LAB B
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-line text-xs font-mono">
          <button
            onClick={() => {
              if (lab === "lab_b") setLab("lab_a");
              setMode("demo");
            }}
            title="Synthetic Demo: Full verified path with MariaDB patch demonstration (Lab A only)"
            className={`px-2.5 py-1 rounded-md transition-all ${
              mode === "demo"
                ? "bg-surface text-copper font-semibold shadow-subtle"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            DEMO
          </button>
          <button
            onClick={() => setMode("mock")}
            title="Lab Mock: Standard offline mock scanner run. Yields fail-closed no_modeled_paths"
            className={`px-2.5 py-1 rounded-md transition-all ${
              mode === "mock"
                ? "bg-surface text-ink font-semibold shadow-subtle"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            MOCK
          </button>
          <button
            disabled
            title="Live Scan: Unavailable without local Docker Desktop, Nmap, and Trivy."
            className="px-2.5 py-1 rounded-md text-ink-3/40 cursor-not-allowed line-through"
          >
            LIVE
          </button>
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-3">
        {getStatusBadge()}

        {bundle?.synthetic && (
          <span className="text-[11px] font-mono tracking-wider font-semibold text-copper bg-copper/10 px-2 py-0.5 rounded border border-copper/20">
            SYNTHETIC DATA
          </span>
        )}

        {bundle?.source === "snapshot" && (
          <span className="text-[11px] font-mono text-ink-2 bg-line px-2 py-0.5 rounded">
            SNAPSHOT REPLAY
          </span>
        )}

        {/* Guided Demo Button */}
        <button
          onClick={() => setGuidedDemoStep(1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors border border-transparent hover:border-line"
          title="Press 'G' anywhere to start guided tour"
        >
          <Sparkles className="w-3.5 h-3.5 text-copper" />
          <span>Demo Tour (G)</span>
        </button>

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={() => setKeyboardShortcutsOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors border border-transparent hover:border-line"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Shortcuts (?)</span>
        </button>

        {/* Limitations Dialog Trigger */}
        <button
          onClick={() => setLimitationsOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors border border-transparent hover:border-line"
          title="Review model boundaries and limitations"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Boundaries</span>
        </button>

        {/* Report Link */}
        <Link
          to="/console/report"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors border border-line"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Ledger Report</span>
        </Link>

        {/* Primary Run Action */}
        <button
          onClick={handleRun}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-mono font-bold tracking-wide rounded-lg bg-ink text-paper hover:bg-ink/90 active:scale-[0.98] transition-all shadow-subtle focus:outline-none focus:ring-2 focus:ring-copper focus:ring-offset-1 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-copper" />
              <span>RUNNING...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current text-copper" />
              <span>RUN ANALYSIS</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
