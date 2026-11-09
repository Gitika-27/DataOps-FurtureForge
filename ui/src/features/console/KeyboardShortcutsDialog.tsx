import React from "react";
import { X, Keyboard, Sparkles, Play, Maximize2, Layers, ShieldCheck, Wrench } from "lucide-react";
import { useConsoleStore } from "./useConsoleStore";

export const KeyboardShortcutsDialog: React.FC = () => {
  const { isKeyboardShortcutsOpen, setKeyboardShortcutsOpen } = useConsoleStore();

  if (!isKeyboardShortcutsOpen) return null;

  const shortcuts = [
    {
      key: "G",
      label: "Guided Demo Tour",
      description: "Launches the 8-step interactive walkthrough with spotlight highlights.",
      icon: <Sparkles className="w-4 h-4 text-copper" />,
    },
    {
      key: "Space",
      label: "Toggle Verified Plan Cut",
      description: "Plays the 7-second min-cut animation or toggles the verified graph cut state.",
      icon: <Play className="w-4 h-4 text-verified" />,
    },
    {
      key: "R",
      label: "Run Engine Analysis",
      description: "Executes the live backend pipeline on the active lab and mode.",
      icon: <Wrench className="w-4 h-4 text-copper" />,
    },
    {
      key: "F",
      label: "Fit Graph to Canvas",
      description: "Centers and scales the Cytoscape topology to fit the viewport.",
      icon: <Maximize2 className="w-4 h-4 text-ink-2" />,
    },
    {
      key: "1 / 2 / 3",
      label: "Switch Inspector Tabs",
      description: "Quickly toggle between Plan & Verify (1), Skeptic Agent (2), and Asset Details (3).",
      icon: <Layers className="w-4 h-4 text-ink-2" />,
    },
    {
      key: "? / K",
      label: "Toggle Shortcuts Guide",
      description: "Displays this keyboard command cheat sheet.",
      icon: <Keyboard className="w-4 h-4 text-ink-2" />,
    },
    {
      key: "Esc",
      label: "Deselect / Dismiss",
      description: "Clears current asset or edge selection and closes open dialogs.",
      icon: <X className="w-4 h-4 text-ink-2" />,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setKeyboardShortcutsOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-2xl p-6 shadow-card space-y-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-copper/10 border border-copper/20 flex items-center justify-center text-copper">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-ink">
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] font-mono text-ink-3 -mt-0.5">
                Quick terminal-style controls for power operators
              </p>
            </div>
          </div>
          <button
            onClick={() => setKeyboardShortcutsOpen(false)}
            className="p-1 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="p-3 rounded-xl border border-line bg-surface-2/40 hover:bg-surface-2/80 transition-colors flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-surface border border-line mt-0.5">
                  {sc.icon}
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-ink">
                    {sc.label}
                  </div>
                  <div className="text-[11px] font-mono text-ink-2 leading-relaxed mt-0.5">
                    {sc.description}
                  </div>
                </div>
              </div>
              <kbd className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-surface border border-line text-ink shadow-subtle flex-shrink-0">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-ink-3">
          <span>Shortcuts are active anywhere in the console</span>
          <button
            onClick={() => setKeyboardShortcutsOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-ink text-paper font-semibold hover:bg-ink/90 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
