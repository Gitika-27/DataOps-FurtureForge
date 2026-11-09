import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ShieldAlert, AlertTriangle } from "lucide-react";
import { useConsoleStore } from "./useConsoleStore";

export const LimitationsDialog: React.FC = () => {
  const { isLimitationsOpen, setLimitationsOpen } = useConsoleStore();

  const limitations = [
    {
      num: "01",
      title: "Evidence-Bounded Modeling",
      desc: "The attack graph represents only relationships and exploitable paths supported by available scanner findings, observed service versions, and topology reachability records. It is a mathematical model, not ground truth.",
    },
    {
      num: "02",
      title: "Missing Evidence & Path Omission",
      desc: "Missing evidence can mean missing modeled paths. If a scanner fails to discover a port or service, or if NVD enrichment cache is unpopulated, no attack edge is drawn (fail-closed behavior).",
    },
    {
      num: "03",
      title: "Not Proof of Total Security",
      desc: "The system does not establish that all vulnerabilities, routes, or misconfigurations were found. A 'verified' plan or a '0 modeled paths' count is never proof of complete organizational safety.",
    },
    {
      num: "04",
      title: "Optimization Assumptions & Cost",
      desc: "Min-cut optimization depends strictly on the supplied candidate patches and estimated patch costs. In reality, operational patch effort, downtime risk, and dependency chains may differ.",
    },
    {
      num: "05",
      title: "Verification Boundary",
      desc: "Independent verification re-checks the bounded modeled problem (capped at 8 hops). It does not test zero-day exploits, physical access, social engineering, or lateral movement outside the modeled scope.",
    },
    {
      num: "06",
      title: "Synthetic Data Discipline",
      desc: "Synthetic fixtures (e.g. CVE-2099-* IDs) demonstrate engine mechanics, solver algorithms, and interface behaviors. They must never be cited as real-world security assessments.",
    },
  ];

  return (
    <Dialog.Root open={isLimitationsOpen} onOpenChange={setLimitationsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-surface border border-line rounded-2xl p-6 shadow-deep z-50 animate-unfold-top focus:outline-none">
          <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-caution/10 border border-caution/20 text-caution flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <Dialog.Title className="font-serif text-xl font-bold text-ink">
                  Model Boundaries & Limitations
                </Dialog.Title>
                <Dialog.Description className="text-xs font-mono text-ink-3">
                  Honest architectural disclosure · Law 2 compliance
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {limitations.map((lim) => (
              <div
                key={lim.num}
                className="p-3.5 rounded-xl border border-line bg-surface-2/40 space-y-1 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-copper px-1.5 py-0.5 rounded bg-copper/10">
                    § {lim.num}
                  </span>
                  <span className="font-serif font-bold text-ink text-sm">
                    {lim.title}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
                  {lim.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-ink-3">
            <span>Evidence-bounded model · No exploits executed</span>
            <Dialog.Close asChild>
              <button className="px-4 py-1.5 rounded-lg bg-ink text-paper hover:bg-ink/90 font-bold text-xs transition-colors">
                Understood
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
