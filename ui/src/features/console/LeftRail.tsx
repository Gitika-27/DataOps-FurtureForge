import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Server,
  Globe,
  Database,
  Shield,
  FileCode,
  CheckCircle2,
  CircleDot,
  Radio,
  HardDrive,
  Lock,
  ChevronRight,
  Filter,
  Sparkles,
} from "lucide-react";
import { useConsoleStore, AssetFilterChipType } from "./useConsoleStore";
import { Asset, ZoneType } from "@/api/types";

export const LeftRail: React.FC = () => {
  const navigate = useNavigate();
  const {
    bundle,
    selectedAssetId,
    assetFilterChip,
    selectAsset,
    setActiveInspectorTab,
    setSkepticStatusFilter,
    setActiveGraphFilter,
    setIsVerifiedPlanShown,
    setAssetFilterChip,
    setHoveredAssetId,
  } = useConsoleStore();

  const [search, setSearch] = useState("");

  const assets: Asset[] = bundle?.assets || [];
  const rawFindings = bundle?.raw_findings || [];
  const reviewedFindings = bundle?.reviewed_findings || [];

  // Filter assets by search query and filter chip
  const filteredAssets = assets.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch = a.id.toLowerCase().includes(q) || a.ip.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (assetFilterChip === "crown") return a.is_crown_jewel;
    if (assetFilterChip === "entry") return a.is_entry_point;
    if (assetFilterChip === "vulnerable") {
      return reviewedFindings.some((rf) => rf.asset_id === a.id);
    }
    return true;
  });

  const assetsByZone: Record<ZoneType, Asset[]> = {
    internet: filteredAssets.filter((a) => a.zone === "internet"),
    dmz: filteredAssets.filter((a) => a.zone === "dmz"),
    internal: filteredAssets.filter((a) => a.zone === "internal"),
  };

  const getRoleIcon = (id: string) => {
    const lower = id.toLowerCase();
    if (lower.startsWith("web")) return <Globe className="w-3.5 h-3.5 text-copper" />;
    if (lower.startsWith("db")) return <Database className="w-3.5 h-3.5 text-crown" />;
    if (lower.startsWith("file")) return <HardDrive className="w-3.5 h-3.5 text-ink-2" />;
    if (lower.startsWith("jump")) return <Lock className="w-3.5 h-3.5 text-ink-2" />;
    return <Server className="w-3.5 h-3.5 text-ink-2" />;
  };

  // Interactive Pipeline steps
  const steps = [
    {
      label: "Findings",
      done: Boolean(bundle?.raw_findings && bundle.raw_findings.length > 0),
      action: () => {
        setActiveInspectorTab("skeptic");
        setSkepticStatusFilter("all");
      },
    },
    {
      label: "Skeptic",
      done: Boolean(bundle?.verdicts && bundle.verdicts.length > 0),
      action: () => {
        setActiveInspectorTab("skeptic");
        setSkepticStatusFilter("confirmed");
      },
    },
    {
      label: "Graph",
      done: Boolean(bundle?.graph?.nodes && bundle.graph.nodes.length > 0),
      action: () => {
        setActiveGraphFilter("all");
      },
    },
    {
      label: "Optimize",
      done: Boolean(bundle?.plan?.plan),
      action: () => {
        setActiveInspectorTab("plan");
      },
    },
    {
      label: "Verify",
      done: Boolean(bundle?.plan?.verification),
      action: () => {
        setIsVerifiedPlanShown(true);
        setActiveInspectorTab("plan");
      },
    },
    {
      label: "Report",
      done: Boolean(bundle?.artifacts?.report_html),
      action: () => {
        navigate("/console/report");
      },
    },
  ];

  return (
    <aside className="w-72 border-r border-line bg-surface flex flex-col h-full select-none z-20">
      {/* Clickable Pipeline Stepper */}
      <div className="p-3 border-b border-line bg-surface-2/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 font-semibold">
            § 01 · Pipeline Stepper
          </span>
          <span className="text-[10px] font-mono text-copper font-medium">Interactive</span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {steps.map((step) => (
            <button
              key={step.label}
              onClick={step.action}
              title={`Jump to ${step.label} (${step.done ? "Complete" : "Pending"})`}
              className="flex flex-col items-center gap-1 group py-1 rounded hover:bg-surface-2 transition-colors text-left"
            >
              <div
                className={`w-full h-1.5 rounded-full transition-all duration-300 ${
                  step.done
                    ? "bg-copper group-hover:bg-copper/80 shadow-[0_0_8px_rgba(184,98,47,0.4)]"
                    : "bg-line"
                }`}
              />
              <span
                className={`text-[9px] font-mono truncate max-w-full ${
                  step.done ? "text-ink font-semibold group-hover:text-copper" : "text-ink-3/70"
                }`}
              >
                {step.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Asset Search & Quick Filters */}
      <div className="p-3 border-b border-line space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 font-semibold">
            § 02 · Scanned Assets ({assets.length})
          </span>
          <span className="text-[10px] font-mono text-ink-3">
            {filteredAssets.length} match
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search asset ID or IP..."
            className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-surface-2 border border-line rounded-lg focus:outline-none focus:border-copper text-ink placeholder:text-ink-3"
          />
        </div>

        {/* Asset Filter Chips */}
        <div className="flex items-center gap-1 text-[10px] font-mono pt-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "crown", label: "Crown" },
              { id: "entry", label: "Entry" },
              { id: "vulnerable", label: "Vuln" },
            ] as { id: AssetFilterChipType; label: string }[]
          ).map((chip) => (
            <button
              key={chip.id}
              onClick={() => setAssetFilterChip(chip.id)}
              className={`flex-1 py-1 px-1 rounded-md text-center transition-all ${
                assetFilterChip === chip.id
                  ? "bg-copper text-white font-bold shadow-subtle"
                  : "bg-surface-2 text-ink-2 hover:bg-surface-2/80 hover:text-ink border border-line"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Assets List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {(["internet", "dmz", "internal"] as ZoneType[]).map((zone) => {
          const zoneAssets = assetsByZone[zone];
          if (!zoneAssets || zoneAssets.length === 0) return null;

          const zoneLabel =
            zone === "internet"
              ? "INTERNET (OUTER)"
              : zone === "dmz"
              ? "DMZ (MIDDLE)"
              : "INTERNAL (CORE)";

          return (
            <div key={zone} className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-ink-3">
                  {zoneLabel}
                </span>
                <span className="text-[10px] font-mono text-ink-3 font-semibold">
                  {zoneAssets.length}
                </span>
              </div>

              <div className="space-y-1">
                {zoneAssets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  const assetVulns = reviewedFindings.filter((f) => f.asset_id === asset.id);

                  return (
                    <button
                      key={asset.id}
                      onClick={() => selectAsset(asset.id)}
                      onMouseEnter={() => setHoveredAssetId(asset.id)}
                      onMouseLeave={() => setHoveredAssetId(null)}
                      className={`w-full text-left p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between group ${
                        isSelected
                          ? "bg-surface-2 border-copper text-ink font-semibold shadow-subtle ring-1 ring-copper/40"
                          : "bg-surface border-line hover:border-line-strong text-ink-2 hover:text-ink"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getRoleIcon(asset.id)}
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-ink">
                              {asset.id}
                            </span>
                            {asset.is_crown_jewel && (
                              <span className="text-[9px] px-1 py-0.2 text-amber-900 bg-amber-100 rounded font-bold border border-amber-300">
                                CROWN
                              </span>
                            )}
                            {asset.is_entry_point && (
                              <span className="text-[9px] px-1 py-0.2 text-blue-900 bg-blue-100 rounded font-bold border border-blue-300">
                                ENTRY
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-ink-3">
                            {asset.ip}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-ink-3">
                        {assetVulns.length > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-threat/10 text-threat border border-threat/20 font-bold">
                            {assetVulns.length} {assetVulns.length === 1 ? "vuln" : "vulns"}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-line">
                          crit {asset.criticality}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {assets.length === 0 && (
          <div className="text-center py-8 text-ink-3 font-mono text-xs">
            No assets loaded.
            <div className="mt-1 text-[11px]">Click "Run analysis" to begin.</div>
          </div>
        )}
      </div>
    </aside>
  );
};
