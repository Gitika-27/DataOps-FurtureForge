import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Wrench,
  CheckCircle2,
  Search,
  Zap,
  ArrowRight,
  Server,
  Lock,
  Database,
  Globe,
  HardDrive,
  Sliders,
} from "lucide-react";
import { useConsoleStore } from "./useConsoleStore";
import { classifyEvidenceLine } from "@/api/evidenceClassifier";
import { VerdictStatus } from "@/api/types";
import { useTilt } from "@/lib/motion/useTilt";

export const Inspector: React.FC = () => {
  const {
    bundle,
    activeInspectorTab,
    selectedAssetId,
    selectedPatchId,
    selectedFindingId,
    skepticStatusFilter,
    skepticSearch,
    isVerifiedPlanShown,
    setActiveInspectorTab,
    setSkepticStatusFilter,
    setSkepticSearch,
    selectAsset,
    selectPatch,
    selectFinding,
    selectEdge,
    setIsVerifiedPlanShown,
  } = useConsoleStore();

  const [expandedVerdictId, setExpandedVerdictId] = useState<string | null>(null);
  const [expandedProofStep, setExpandedProofStep] = useState<number | null>(null);

  const plan = bundle?.plan?.plan;
  const verification = bundle?.plan?.verification;
  const verdicts = bundle?.verdicts || [];
  const reviewedFindings = bundle?.reviewed_findings || [];
  const rawFindings = bundle?.raw_findings || [];
  const assets = bundle?.assets || [];
  const services = bundle?.services || [];
  const reach = bundle?.reach || [];
  const cutEdges = bundle?.derived?.cut_edges || [];

  // Filter verdicts by status chip and search query
  const filteredVerdicts = useMemo(() => {
    return verdicts.filter((v) => {
      if (skepticStatusFilter !== "all" && v.status !== skepticStatusFilter) return false;
      if (!skepticSearch) return true;
      const q = skepticSearch.toLowerCase();
      const finding = reviewedFindings.find((rf) => rf.id === v.finding_id);
      return (
        v.finding_id.toLowerCase().includes(q) ||
        (v.reasoning && v.reasoning.toLowerCase().includes(q)) ||
        (finding && finding.cve.toLowerCase().includes(q)) ||
        (finding && finding.asset_id.toLowerCase().includes(q))
      );
    });
  }, [verdicts, skepticStatusFilter, skepticSearch, reviewedFindings]);

  const confirmedCount = verdicts.filter((v) => v.status === "confirmed").length;
  const downgradedCount = verdicts.filter((v) => v.status === "downgraded").length;
  const rejectedCount = verdicts.filter((v) => v.status === "rejected").length;

  // Selected asset details
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const assetServices = services.filter((s) => s.asset_id === selectedAssetId);
  const assetFindings = rawFindings.filter((f) => f.asset_id === selectedAssetId);
  const reachIn = reach.filter((r) => r.dst === selectedAssetId);
  const reachOut = reach.filter((r) => r.src === selectedAssetId);

  return (
    <aside className="w-96 border-l border-line bg-surface flex flex-col h-full select-none z-20">
      {/* Inspector Tabs Header */}
      <div className="flex border-b border-line bg-surface-2/40 text-xs font-mono">
        <button
          onClick={() => setActiveInspectorTab("plan")}
          className={`flex-1 py-3 text-center font-semibold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeInspectorTab === "plan"
              ? "border-copper text-ink bg-surface"
              : "border-transparent text-ink-3 hover:text-ink hover:bg-surface-2"
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Plan & Verify</span>
        </button>
        <button
          onClick={() => setActiveInspectorTab("skeptic")}
          className={`flex-1 py-3 text-center font-semibold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeInspectorTab === "skeptic"
              ? "border-copper text-ink bg-surface"
              : "border-transparent text-ink-3 hover:text-ink hover:bg-surface-2"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Skeptic ({verdicts.length})</span>
        </button>
        <button
          onClick={() => setActiveInspectorTab("asset")}
          className={`flex-1 py-3 text-center font-semibold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeInspectorTab === "asset"
              ? "border-copper text-ink bg-surface"
              : "border-transparent text-ink-3 hover:text-ink hover:bg-surface-2"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Asset {selectedAssetId ? `(${selectedAssetId})` : ""}</span>
        </button>
      </div>

      {/* Tab 1: Remediation Plan & Independent Verification */}
      {activeInspectorTab === "plan" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status Stamp & Banner */}
          <div className="p-3.5 rounded-xl border border-line bg-surface-2/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 font-semibold">
                PLAN VERIFICATION STATUS
              </span>
              {bundle?.status === "verified" && (
                <span className="stamp stamp-verified">VERIFIED</span>
              )}
              {bundle?.status === "no_modeled_paths" && (
                <span className="stamp stamp-no-paths">NO MODELED PATHS</span>
              )}
              {bundle?.status === "invalid" && (
                <span className="stamp stamp-invalid">INVALID</span>
              )}
              {!bundle && (
                <span className="text-xs font-mono text-ink-3">Awaiting run</span>
              )}
            </div>

            {bundle?.status === "verified" && (
              <p className="text-xs font-mono text-ink-2 leading-relaxed">
                Plan independently verified against the bounded modeled graph. All modeled paths from entry points to crown jewels are cut.
              </p>
            )}
            {bundle?.status === "no_modeled_paths" && (
              <p className="text-xs font-mono text-caution leading-relaxed">
                No supported attack paths were modeled. This is not proof that the scanned environment is safe; evidence was insufficient to attribute remote exploitability.
              </p>
            )}
          </div>

          {/* Interactive Simulation Controls */}
          {bundle?.status === "verified" && (
            <div className="p-3 rounded-xl border border-line bg-surface flex items-center justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-ink">Simulate Plan Cut</div>
                <div className="text-[10px] font-mono text-ink-3">Toggle graph cut state in real time</div>
              </div>
              <button
                onClick={() => setIsVerifiedPlanShown(!isVerifiedPlanShown)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  isVerifiedPlanShown
                    ? "bg-verified text-paper shadow-subtle"
                    : "bg-surface-2 border border-line text-ink hover:border-line-strong"
                }`}
              >
                {isVerifiedPlanShown ? "Cut Active" : "Uncut (Before)"}
              </button>
            </div>
          )}

          {/* Selected Patches Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 font-semibold">
                PROPOSED ACTIONS ({plan?.patches?.length || 0})
              </span>
              <span className="text-[10px] font-mono text-ink-3">
                Cost-aware min-cut
              </span>
            </div>

            {plan?.patches && plan.patches.length > 0 ? (
              <div className="space-y-2">
                {plan.patches.map((patchId) => {
                  const relatedFindings = reviewedFindings.filter(
                    (f) => f.patch_id === patchId
                  );

                  return (
                    <div
                      key={patchId}
                      className="p-3 rounded-xl border border-line bg-surface hover:border-line-strong transition-all space-y-2.5 shadow-subtle"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-ink flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-copper" />
                          <span>{patchId}</span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 border border-line text-copper font-semibold">
                          cost: {relatedFindings[0]?.patch_cost ?? 1}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-ink-2 space-y-1">
                        <div className="text-ink-3 text-[10px] uppercase tracking-wider">
                          Interrupted attack edges:
                        </div>
                        {cutEdges.map((ce, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              selectAsset(ce.src);
                              selectEdge({
                                id: `attack-${ce.src}-${ce.dst}`,
                                source: ce.src,
                                target: ce.dst,
                                ports: [3306],
                                patchIds: [patchId],
                                isOnModeledPath: true,
                                isCut: true,
                              });
                            }}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-surface-2/60 hover:bg-surface-2 border border-line cursor-pointer text-threat font-semibold transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{ce.src}</span>
                              <span>→</span>
                              <span>{ce.dst}</span>
                            </div>
                            <span className="text-[9px] text-verified font-bold bg-verified/10 px-1.5 py-0.5 rounded border border-verified/20">
                              CUT ON GRAPH
                            </span>
                          </div>
                        ))}
                      </div>

                      {relatedFindings.length > 0 && (
                        <div className="pt-2 border-t border-line text-[11px] font-mono space-y-1">
                          <span className="text-[10px] text-ink-3 uppercase tracking-wider">
                            Attributed finding:
                          </span>
                          {relatedFindings.map((rf) => (
                            <div
                              key={rf.id}
                              onClick={() => {
                                selectFinding(rf.id);
                                setActiveInspectorTab("skeptic");
                              }}
                              className="flex items-center justify-between text-xs p-1 rounded hover:bg-surface-2 cursor-pointer"
                            >
                              <span className="text-copper font-semibold">{rf.cve}</span>
                              <span className="text-ink-3">{rf.asset_id}:{rf.port}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-line bg-surface text-center text-xs font-mono text-ink-3">
                No remediation actions required.
              </div>
            )}
          </div>

          {/* Independent Verification Checklist */}
          <div className="space-y-2 pt-2 border-t border-line">
            <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 font-semibold">
              INDEPENDENT VERIFICATION PROOFS
            </span>

            <div className="space-y-2 text-xs font-mono">
              {[
                {
                  id: 1,
                  title: "1. Fresh Subgraph Construction",
                  desc: "Clones the modeled graph into an isolated verification copy via nx.DiGraph.copy().",
                  formula: "G_copy = nx.DiGraph(G_original)",
                },
                {
                  id: 2,
                  title: "2. Full Patch Coverage Gate",
                  desc: "Removes an edge only if ALL of its required patch IDs are present in the proposed plan.",
                  formula: "all(p in selected_patches for p in edge.patch_ids)",
                },
                {
                  id: 3,
                  title: "3. Modeled Path Re-Enumeration",
                  desc: "Re-runs simple path discovery from all entry points to crown jewels (max 8 hops).",
                  formula: "nx.all_simple_paths(G_copy, entry, crown, cutoff=8)",
                },
                {
                  id: 4,
                  title: "4. Zero-Path Invariant Proof",
                  desc: "Requires paths_after == 0 for plan approval. Rejects any non-zero count as invalid.",
                  formula: "assert len(paths_after) == 0",
                },
              ].map((step) => {
                const isExpanded = expandedProofStep === step.id;
                return (
                  <div
                    key={step.id}
                    className="p-2.5 rounded-xl border border-line bg-surface hover:border-line-strong transition-all"
                  >
                    <button
                      onClick={() => setExpandedProofStep(isExpanded ? null : step.id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-verified" />
                        <span className="font-semibold text-ink">{step.title}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-ink-3" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-line text-[11px] text-ink-2 space-y-1">
                        <p>{step.desc}</p>
                        <div className="p-1.5 rounded bg-surface-2 font-mono text-[10px] text-copper">
                          {step.formula}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Deterministic Skeptic Agent Ledger */}
      {activeInspectorTab === "skeptic" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              value={skepticSearch}
              onChange={(e) => setSkepticSearch(e.target.value)}
              placeholder="Search findings by CVE or host..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-surface-2 border border-line rounded-lg focus:outline-none focus:border-copper text-ink placeholder:text-ink-3"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1 text-[11px] font-mono">
            <button
              onClick={() => setSkepticStatusFilter("all")}
              className={`px-2 py-1 rounded-md transition-all ${
                skepticStatusFilter === "all"
                  ? "bg-ink text-paper font-semibold"
                  : "bg-surface-2 text-ink-2 hover:text-ink"
              }`}
            >
              All ({verdicts.length})
            </button>
            <button
              onClick={() => setSkepticStatusFilter("confirmed")}
              className={`px-2 py-1 rounded-md transition-all ${
                skepticStatusFilter === "confirmed"
                  ? "bg-verified text-paper font-semibold"
                  : "bg-verified/10 text-verified hover:bg-verified/20"
              }`}
            >
              Confirmed ({confirmedCount})
            </button>
            <button
              onClick={() => setSkepticStatusFilter("downgraded")}
              className={`px-2 py-1 rounded-md transition-all ${
                skepticStatusFilter === "downgraded"
                  ? "bg-caution text-paper font-semibold"
                  : "bg-caution/10 text-caution hover:bg-caution/20"
              }`}
            >
              Downgraded ({downgradedCount})
            </button>
            <button
              onClick={() => setSkepticStatusFilter("rejected")}
              className={`px-2 py-1 rounded-md transition-all ${
                skepticStatusFilter === "rejected"
                  ? "bg-threat text-paper font-semibold"
                  : "bg-threat/10 text-threat hover:bg-threat/20"
              }`}
            >
              Rejected ({rejectedCount})
            </button>
          </div>

          {/* Verdicts Accordion List */}
          <div className="space-y-2 pt-1">
            {filteredVerdicts.map((v) => {
              const isExpanded = expandedVerdictId === v.finding_id;
              const finding = reviewedFindings.find((rf) => rf.id === v.finding_id);

              return (
                <div
                  key={v.finding_id}
                  className="rounded-xl border border-line bg-surface hover:border-line-strong transition-all overflow-hidden shadow-subtle"
                >
                  <button
                    onClick={() =>
                      setExpandedVerdictId(isExpanded ? null : v.finding_id)
                    }
                    className="w-full p-3 text-left flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink">
                          {finding?.cve || v.finding_id}
                        </span>
                        {v.status === "confirmed" && (
                          <span className="stamp stamp-verified text-[9px] py-0">
                            CONFIRMED
                          </span>
                        )}
                        {v.status === "downgraded" && (
                          <span className="stamp stamp-no-paths text-[9px] py-0">
                            DOWNGRADED
                          </span>
                        )}
                        {v.status === "rejected" && (
                          <span className="stamp stamp-invalid text-[9px] py-0">
                            REJECTED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-ink-3 mt-1">
                        Host: {finding?.asset_id || "unknown"} · Port: :{finding?.port || 0}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-ink-3 mt-1" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-ink-3 mt-1" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-3 pt-0 border-t border-line/50 space-y-3 font-mono text-xs bg-surface-2/30">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold mt-2">
                          Skeptic Reasoning:
                        </div>
                        <p className="text-ink-2 mt-1 leading-relaxed text-[11px]">
                          {v.reasoning}
                        </p>
                      </div>

                      {/* Evidence Checklist */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                          Evidence Breakdown:
                        </div>
                        <div className="space-y-1">
                          {v.evidence.map((line, idx) => {
                            const category = classifyEvidenceLine(line);
                            return (
                              <div
                                key={idx}
                                className="flex items-start gap-1.5 text-[11px] leading-tight"
                              >
                                {category === "positive" && (
                                  <Check className="w-3.5 h-3.5 text-verified mt-0.5 flex-shrink-0" />
                                )}
                                {category === "warning" && (
                                  <AlertTriangle className="w-3.5 h-3.5 text-caution mt-0.5 flex-shrink-0" />
                                )}
                                {category === "neutral" && (
                                  <HelpCircle className="w-3.5 h-3.5 text-ink-3 mt-0.5 flex-shrink-0" />
                                )}
                                <span className="text-ink-2">{line}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Jump to Graph Button */}
                      {finding && (
                        <div className="pt-2 border-t border-line flex items-center justify-between">
                          <span className="text-[10px] text-ink-3">
                            Confidence: {(v.confidence * 100).toFixed(0)}%
                          </span>
                          <button
                            onClick={() => selectAsset(finding.asset_id)}
                            className="px-2.5 py-1 rounded bg-surface border border-line text-xs hover:border-copper text-copper font-semibold transition-colors"
                          >
                            Focus in Graph →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredVerdicts.length === 0 && (
              <div className="p-4 rounded-xl border border-line bg-surface text-center text-xs font-mono text-ink-3">
                No verdicts match the active filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Asset Details */}
      {activeInspectorTab === "asset" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedAsset ? (
            <div className="space-y-4 font-mono text-xs">
              {/* Asset Identity Card */}
              <div className="p-3.5 rounded-xl border border-line bg-surface-2/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-ink">{selectedAsset.id}</span>
                  <div className="flex items-center gap-1">
                    {selectedAsset.is_crown_jewel && (
                      <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold">
                        CROWN JEWEL
                      </span>
                    )}
                    {selectedAsset.is_entry_point && (
                      <span className="px-1.5 py-0.5 text-[9px] bg-blue-100 text-blue-900 border border-blue-300 rounded font-bold">
                        ENTRY POINT
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-ink-3 text-[11px]">
                  IP: {selectedAsset.ip} · Zone: {selectedAsset.zone.toUpperCase()} · Criticality: {selectedAsset.criticality}/5
                </div>
              </div>

              {/* Running Services */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                  Detected Services ({assetServices.length})
                </div>
                {assetServices.length > 0 ? (
                  <div className="space-y-1.5">
                    {assetServices.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg border border-line bg-surface flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-ink">
                            :{s.port} · {s.name}
                          </div>
                          <div className="text-[10px] text-ink-3">
                            Version: {s.version || "unspecified"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-ink-3 p-2 rounded bg-surface-2">
                    No active services detected on this host.
                  </div>
                )}
              </div>

              {/* Reachability Connections */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                  Inbound Connections ({reachIn.length})
                </div>
                <div className="space-y-1">
                  {reachIn.map((r, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectAsset(r.src)}
                      className="w-full text-left p-1.5 rounded-lg border border-line bg-surface hover:border-line-strong flex items-center justify-between text-[11px]"
                    >
                      <span className="text-ink font-semibold">{r.src}</span>
                      <span className="text-ink-3">:{r.port}</span>
                    </button>
                  ))}
                  {reachIn.length === 0 && (
                    <div className="text-[11px] text-ink-3 p-1.5">None recorded</div>
                  )}
                </div>

                <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold pt-1">
                  Outbound Reachability ({reachOut.length})
                </div>
                <div className="space-y-1">
                  {reachOut.map((r, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectAsset(r.dst)}
                      className="w-full text-left p-1.5 rounded-lg border border-line bg-surface hover:border-line-strong flex items-center justify-between text-[11px]"
                    >
                      <span className="text-ink font-semibold">{r.dst}</span>
                      <span className="text-ink-3">:{r.port}</span>
                    </button>
                  ))}
                  {reachOut.length === 0 && (
                    <div className="text-[11px] text-ink-3 p-1.5">None recorded</div>
                  )}
                </div>
              </div>

              {/* Findings on Asset */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                  Attributed Findings ({assetFindings.length})
                </div>
                <div className="space-y-1.5">
                  {assetFindings.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        selectFinding(f.id);
                        setActiveInspectorTab("skeptic");
                      }}
                      className="w-full text-left p-2 rounded-lg border border-line bg-surface hover:border-copper transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="text-copper font-bold">{f.cve}</div>
                        <div className="text-[10px] text-ink-3">
                          Port :{f.port} · CVSS {f.cvss}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-3" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs font-mono text-ink-3 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-ink-3/40" />
              <div className="font-semibold text-ink">No Asset Selected</div>
              <p>Click any node in the topology stage or asset in the left rail to inspect its identity, services, and reachability.</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
