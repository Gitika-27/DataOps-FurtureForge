import React, { useEffect } from "react";
import { TopBar } from "./TopBar";
import { LeftRail } from "./LeftRail";
import { Stage } from "./Stage";
import { Inspector } from "./Inspector";
import { FooterChip } from "./FooterChip";
import { LimitationsDialog } from "./LimitationsDialog";
import { GuidedDemoOverlay } from "./GuidedDemoOverlay";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { useConsoleStore } from "./useConsoleStore";
import { executeRunApi } from "@/api/client";

export const ConsolePage: React.FC = () => {
  const {
    bundle,
    lab,
    mode,
    loading,
    setBundle,
    setLoading,
    setError,
    setGuidedDemoStep,
    setIsVerifiedPlanShown,
    setKeyboardShortcutsOpen,
    setActiveInspectorTab,
  } = useConsoleStore();

  // Load initial synthetic demo bundle on first mount if none present
  useEffect(() => {
    if (!bundle && !loading) {
      setLoading(true);
      executeRunApi("lab_a", "demo")
        .then((b) => setBundle(b))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setGuidedDemoStep(1);
      } else if (e.key === "?" || e.key === "/" || e.key === "k" || e.key === "K") {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setKeyboardShortcutsOpen(true);
        }
      } else if (e.key === "1") {
        e.preventDefault();
        setActiveInspectorTab("plan");
      } else if (e.key === "2") {
        e.preventDefault();
        setActiveInspectorTab("skeptic");
      } else if (e.key === "3") {
        e.preventDefault();
        setActiveInspectorTab("asset");
      } else if (e.key === "Escape") {
        setIsVerifiedPlanShown(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setGuidedDemoStep, setIsVerifiedPlanShown, setKeyboardShortcutsOpen, setActiveInspectorTab]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-paper text-ink font-sans select-none">
      <TopBar />
      <div className="flex-1 flex overflow-hidden relative">
        <LeftRail />
        <Stage />
        <Inspector />
      </div>
      <FooterChip />
      <LimitationsDialog />
      <GuidedDemoOverlay />
      <KeyboardShortcutsDialog />
    </div>
  );
};
