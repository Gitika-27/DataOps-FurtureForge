import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import cytoscape, { Core, EventObject } from "cytoscape";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Eye,
  EyeOff,
  Sparkles,
  Play,
  Filter,
  X,
  ExternalLink,
  ChevronRight,
  Layers,
  Wrench,
  Zap,
} from "lucide-react";
import { useConsoleStore, GraphFilterType } from "./useConsoleStore";
import { transformToCytoscape } from "@/api/toCytoscape";
import { useCountUp } from "@/lib/motion/useCountUp";

interface HoverTooltipData {
  type: "node" | "edge";
  title: string;
  subtitle: string;
  tags: string[];
  x: number;
  y: number;
}

export const Stage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const animTimeouts = useRef<number[]>([]);

  const {
    bundle,
    loading,
    selectedAssetId,
    selectedEdge,
    showReachEdges,
    isVerifiedPlanShown,
    activeGraphFilter,
    selectAsset,
    selectEdge,
    toggleShowReachEdges,
    setIsVerifiedPlanShown,
    setActiveInspectorTab,
    setActiveGraphFilter,
    selectFinding,
  } = useConsoleStore();

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isChoreographing, setIsChoreographing] = useState(false);
  const [animStageCaption, setAnimStageCaption] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipData | null>(null);
  const [isAttackPulsing, setIsAttackPulsing] = useState(false);

  // Parallax on sibling background slabs
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  // Convert bundle to Cytoscape elements
  const elements = useMemo(() => {
    if (!bundle) return [];
    return transformToCytoscape(
      bundle.assets || [],
      bundle.graph || { nodes: [], edges: [] },
      bundle.plan || { plan: { patches: [], paths_before: 0, paths_after: 0, risk_reduction_pct: 0 }, paths: [] },
      bundle.derived || { max_hops: 8, cut_edges: [], baseline: null },
      bundle.reach || [],
      showReachEdges
    );
  }, [bundle, showReachEdges]);

  // Clear animation timers
  const clearChoreography = useCallback(() => {
    animTimeouts.current.forEach((t) => clearTimeout(t));
    animTimeouts.current = [];
    setIsChoreographing(false);
    setAnimStageCaption(null);
    if (cyRef.current) {
      cyRef.current.userPanningEnabled(true);
      cyRef.current.userZoomingEnabled(true);
    }
  }, []);

  // 7-second Choreographed "Show Verified Plan" sequence
  const startChoreography = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || !bundle || bundle.status !== "verified") return;

    clearChoreography();
    setIsChoreographing(true);
    cy.userPanningEnabled(false);
    cy.userZoomingEnabled(false);

    setAnimStageCaption("Visualising the backend's plan. Nothing is being solved in your browser.");

    // 0.0s: Non-path nodes and edges recede to 20%
    cy.elements().not("[?isOnModeledPath]").animate({
      style: { opacity: 0.2 },
      duration: 400,
    });

    // 0.6s: Pulse red path edges and flash crown jewel
    const t1 = window.setTimeout(() => {
      setAnimStageCaption("Tracing modeled attack path from public entry to crown jewel...");
      cy.edges("[?isOnModeledPath]").animate({
        style: { width: 5, "line-color": "#FF5C50" },
        duration: 500,
      });
      cy.nodes("[?isCrownJewel]").animate({
        style: { "border-color": "#FF5C50" },
        duration: 500,
      });
    }, 600);

    // 2.2s: Target cut edge drop
    const t2 = window.setTimeout(() => {
      setAnimStageCaption("Targeting min-cut bottleneck: patch demo-db-fix on db01:3306");
      cy.edges().forEach((e) => {
        if (e.data("isCut")) {
          e.animate({
            style: { width: 6, "line-color": "#E08A55" },
            duration: 400,
          });
        }
      });
    }, 2200);

    // 3.2s: Slash glint along cut edge, recoil, turn grey dotted
    const t3 = window.setTimeout(() => {
      setAnimStageCaption("Cutting edge: removing attack reachability across database port");
      cy.edges().forEach((e) => {
        if (e.data("isCut")) {
          e.addClass("is-cut");
          e.animate({
            style: {
              width: 2,
              "line-color": "#93A1AB",
              "target-arrow-color": "#93A1AB",
              "line-style": "dotted",
              opacity: 0.45,
            },
            duration: 600,
          });
        }
      });
    }, 3200);

    // 4.2s: HUD counters roll down
    const t4 = window.setTimeout(() => {
      setAnimStageCaption("Attack path eliminated: 1 → 0 paths remaining");
      setIsVerifiedPlanShown(true);
    }, 4200);

    // 5.0s: Crown turns steady verified green, VERIFIED stamp presses in
    const t5 = window.setTimeout(() => {
      setAnimStageCaption("Independently verified: 0 modeled paths remain");
      cy.nodes("[?isCrownJewel]").animate({
        style: { "border-color": "#3DDC97", "background-color": "#112C20" },
        duration: 500,
      });
    }, 5000);

    // 6.2s: Restore brightness, unlock, open Plan tab
    const t6 = window.setTimeout(() => {
      cy.elements().animate({ style: { opacity: 1 }, duration: 400 });
      cy.userPanningEnabled(true);
      cy.userZoomingEnabled(true);
      setIsChoreographing(false);
      setAnimStageCaption(null);
      setActiveInspectorTab("plan");
    }, 6200);

    animTimeouts.current = [t1, t2, t3, t4, t5, t6];
  }, [bundle, clearChoreography, setIsVerifiedPlanShown, setActiveInspectorTab]);

  // Animate Attack Flow (Laser particle flow along attack path)
  const handleAnimateAttackFlow = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || isAttackPulsing) return;

    setIsAttackPulsing(true);
    const pathEdges = cy.edges("[?isOnModeledPath]");

    pathEdges.forEach((edge, idx) => {
      setTimeout(() => {
        edge.animate({
          style: { width: 6, "line-color": "#FF8C7A" },
          duration: 300,
          complete: () => {
            edge.animate({
              style: { width: edge.hasClass("is-cut") ? 2 : 3.5, "line-color": edge.hasClass("is-cut") ? "#93A1AB" : "#FF5C50" },
              duration: 400,
            });
          },
        });
      }, idx * 350);
    });

    setTimeout(() => {
      setIsAttackPulsing(false);
    }, pathEdges.length * 350 + 600);
  }, [isAttackPulsing]);

  // Keyboard listener for Escape & Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.key === "Escape") {
        if (isChoreographing) {
          clearChoreography();
          setIsVerifiedPlanShown(true);
          if (cyRef.current) {
            cyRef.current.elements().style({ opacity: 1 });
            cyRef.current.edges().forEach((edge) => {
              if (edge.data("isCut")) edge.addClass("is-cut");
            });
          }
        } else {
          selectAsset(null);
          selectEdge(null);
        }
      } else if (e.code === "Space" && !isChoreographing) {
        e.preventDefault();
        if (bundle?.status === "verified") {
          if (isVerifiedPlanShown) {
            setIsVerifiedPlanShown(false);
          } else {
            startChoreography();
          }
        }
      } else if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        cyRef.current?.fit(undefined, 40);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChoreographing, isVerifiedPlanShown, bundle, clearChoreography, setIsVerifiedPlanShown, startChoreography, selectAsset, selectEdge]);

  // Initialize and configure Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    if (!cyRef.current) {
      const cy = cytoscape({
        container: containerRef.current,
        elements: [],
        layout: { name: "preset" },
        boxSelectionEnabled: false,
        autounselectify: false,
        wheelSensitivity: 0.3,
        style: [
          // Base Node Style
          {
            selector: "node",
            style: {
              label: "data(label)",
              color: "#E7ECEF",
              "font-family": "Geist Mono, monospace",
              "font-size": 12,
              "text-valign": "bottom",
              "text-margin-y": 8,
              width: 44,
              height: 44,
              "background-color": "#1B2530",
              "border-width": 2,
              "border-color": "#93A1AB",
              "transition-property": "border-color, border-width, background-color, opacity, width, height",
              "transition-duration": 220,
            },
          },
          // Crown Jewel Node
          {
            selector: "node[?isCrownJewel]",
            style: {
              "border-color": "#E8C872",
              "border-width": 4,
              "background-color": "#282415",
              width: 52,
              height: 52,
            },
          },
          // Entry Point Node
          {
            selector: "node[?isEntryPoint]",
            style: {
              "border-color": "#E08A55",
              "border-width": 3,
            },
          },
          // Selected Node
          {
            selector: "node:selected",
            style: {
              "border-color": "#E08A55",
              "border-width": 4,
              "background-color": "#2A231C",
            },
          },
          // Base Edge Style
          {
            selector: "edge",
            style: {
              width: 2,
              "line-color": "rgba(255,255,255,0.18)",
              "target-arrow-color": "rgba(255,255,255,0.18)",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              "arrow-scale": 1,
              "transition-property": "line-color, target-arrow-color, width, opacity",
              "transition-duration": 250,
            },
          },
          // Attack Edge on Modeled Path (Red flowing)
          {
            selector: "edge[?isOnModeledPath]",
            style: {
              width: 3.5,
              "line-color": "#FF5C50",
              "target-arrow-color": "#FF5C50",
              "line-style": "solid",
            },
          },
          // Graph edge NOT on modeled path (Amber muted)
          {
            selector: "edge[!isOnModeledPath][!isReachOnly]",
            style: {
              width: 2,
              "line-color": "#F2B33D",
              "target-arrow-color": "#F2B33D",
              "line-style": "dashed",
              opacity: 0.6,
            },
          },
          // Reachability Edge only (hairline grey)
          {
            selector: "edge[?isReachOnly]",
            style: {
              width: 1,
              "line-color": "rgba(255,255,255,0.12)",
              "target-arrow-color": "rgba(255,255,255,0.12)",
              "line-style": "dotted",
              opacity: 0.35,
            },
          },
          // Cut Edge (after verification shown: grey dotted)
          {
            selector: "edge.is-cut",
            style: {
              width: 2,
              "line-color": "#93A1AB",
              "target-arrow-color": "#93A1AB",
              "line-style": "dotted",
              opacity: 0.45,
            },
          },
          // Highlighted Active Edge
          {
            selector: "edge:selected, edge.edge-active",
            style: {
              width: 4.5,
              "line-color": "#E08A55",
              "target-arrow-color": "#E08A55",
              opacity: 1,
            },
          },
          // Dimmed Elements Class
          {
            selector: ".dimmed",
            style: {
              opacity: 0.15,
            },
          },
          // Focused Element Class
          {
            selector: ".focused",
            style: {
              opacity: 1,
            },
          },
        ],
      });

      // Node click handler: selects asset, smooth centers camera, highlights neighbors
      cy.on("tap", "node", (evt: EventObject) => {
        const node = evt.target;
        selectAsset(node.id());
        cy.animate({
          center: { eles: node },
          zoom: Math.max(cy.zoom(), 1.15),
          duration: 350,
        });
      });

      // Edge click handler: selects edge, pops detail card
      cy.on("tap", "edge", (evt: EventObject) => {
        const edge = evt.target;
        selectEdge(edge.data());
      });

      // Canvas background click: deselects
      cy.on("tap", (evt: EventObject) => {
        if (evt.target === cy) {
          selectAsset(null);
          selectEdge(null);
        }
      });

      // Double-click canvas to fit
      cy.on("dbltap", (evt: EventObject) => {
        if (evt.target === cy) {
          cy.fit(undefined, 40);
        }
      });

      // Tooltip Hover Handlers
      cy.on("mouseover", "node", (evt: EventObject) => {
        const node = evt.target;
        const d = node.data();
        const renderedPos = node.renderedPosition();
        setHoverTooltip({
          type: "node",
          title: d.id,
          subtitle: `${d.zone.toUpperCase()} · ${d.ip}`,
          tags: [
            d.isCrownJewel ? "CROWN JEWEL" : "",
            d.isEntryPoint ? "ENTRY POINT" : "",
            `CRIT ${d.criticality}`,
          ].filter(Boolean),
          x: renderedPos.x,
          y: renderedPos.y - 40,
        });
      });

      cy.on("mouseout", "node", () => setHoverTooltip(null));

      cy.on("mouseover", "edge", (evt: EventObject) => {
        const edge = evt.target;
        const d = edge.data();
        const midX = (edge.source().renderedPosition().x + edge.target().renderedPosition().x) / 2;
        const midY = (edge.source().renderedPosition().y + edge.target().renderedPosition().y) / 2;
        setHoverTooltip({
          type: "edge",
          title: `${d.source} → ${d.target}`,
          subtitle: d.ports && d.ports.length ? `Ports: :${d.ports.join(", ")}` : "Reachability",
          tags: [
            d.isOnModeledPath ? "MODELED ATTACK PATH" : "",
            d.isCut ? "VERIFIED CUT" : "",
            d.patchIds && d.patchIds.length ? `Patch: ${d.patchIds[0]}` : "",
          ].filter(Boolean),
          x: midX,
          y: midY - 30,
        });
      });

      cy.on("mouseout", "edge", () => setHoverTooltip(null));

      cyRef.current = cy;
    }

    const cy = cyRef.current;
    cy.elements().remove();
    cy.add(elements);

    // Apply layout and fit
    cy.layout({ name: "preset" }).run();
    cy.fit(undefined, 40);

    // If verified plan is shown, apply the .is-cut class to cut edges
    if (isVerifiedPlanShown) {
      cy.edges().forEach((e) => {
        if (e.data("isCut")) {
          e.addClass("is-cut");
        }
      });
      cy.nodes("[?isCrownJewel]").style({ "border-color": "#3DDC97" });
    } else {
      cy.edges().removeClass("is-cut");
      cy.nodes("[?isCrownJewel]").style({ "border-color": "#E8C872" });
    }
  }, [elements, isVerifiedPlanShown, selectAsset, selectEdge]);

  // Synchronize external selection & filters with Cytoscape visual state
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || isChoreographing) return;

    cy.elements().removeClass("dimmed focused edge-active");
    cy.nodes().unselect();
    cy.edges().unselect();

    // 1. Stage Filter Highlighting
    if (activeGraphFilter === "attack_path") {
      cy.elements().not("[?isOnModeledPath]").addClass("dimmed");
      cy.elements("[?isOnModeledPath]").addClass("focused");
    } else if (activeGraphFilter === "crown_jewels") {
      const crown = cy.nodes("[?isCrownJewel]");
      const inEdges = crown.incomers("edge");
      cy.elements().addClass("dimmed");
      crown.removeClass("dimmed").addClass("focused");
      inEdges.removeClass("dimmed").addClass("focused");
      inEdges.sources().removeClass("dimmed").addClass("focused");
    } else if (activeGraphFilter === "cut_edges") {
      const cutEdges = cy.edges().filter((e) => e.data("isCut"));
      cy.elements().addClass("dimmed");
      cutEdges.removeClass("dimmed").addClass("focused");
      cutEdges.connectedNodes().removeClass("dimmed").addClass("focused");
    }

    // 2. Specific Asset Selection
    if (selectedAssetId) {
      const match = cy.getElementById(selectedAssetId);
      if (match.length) {
        match.select();
        match.removeClass("dimmed").addClass("focused");

        // Keep connected edges and neighbor nodes bright, dim others
        const connectedEdges = match.connectedEdges();
        const neighbors = match.neighborhood("node");

        cy.elements().addClass("dimmed");
        match.removeClass("dimmed").addClass("focused");
        connectedEdges.removeClass("dimmed").addClass("focused");
        neighbors.removeClass("dimmed").addClass("focused");
      }
    }

    // 3. Specific Edge Selection
    if (selectedEdge) {
      const edgeMatch = cy.getElementById(selectedEdge.id);
      if (edgeMatch.length) {
        edgeMatch.addClass("edge-active").removeClass("dimmed");
        edgeMatch.connectedNodes().removeClass("dimmed").addClass("focused");
        cy.elements().not(edgeMatch).not(edgeMatch.connectedNodes()).addClass("dimmed");
      }
    }
  }, [selectedAssetId, selectedEdge, activeGraphFilter, isChoreographing]);

  // HUD Count-up metrics
  const pathsBefore = bundle?.plan?.plan?.paths_before ?? 0;
  const pathsAfter = isVerifiedPlanShown ? (bundle?.plan?.plan?.paths_after ?? 0) : pathsBefore;
  const animatedPaths = useCountUp(pathsAfter, 500);
  const patchCount = bundle?.plan?.plan?.patches?.length ?? 0;
  const baseline = bundle?.derived?.baseline;

  // Zoom controls
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 40);
  const handleReset = () => {
    cyRef.current?.reset();
    cyRef.current?.layout({ name: "preset" }).run();
    cyRef.current?.fit(undefined, 40);
  };

  return (
    <div
      className="flex-1 h-full relative overflow-hidden bg-stage-bg select-none"
      onMouseMove={handleMouseMove}
    >
      {/* 3 Layered Depth Zone Slabs (Behind canvas, pointer-events none) */}
      <div className="absolute inset-0 pointer-events-none flex z-0 overflow-hidden">
        {/* Layer 1: Internet (Lightest, shallowest parallax 4px) */}
        <div
          className="w-1/3 h-full border-r border-white/5 transition-transform duration-75 ease-out relative"
          style={{
            backgroundColor: "rgba(18, 26, 33, 0.45)",
            transform: `translate3d(${mousePos.x * 4}px, ${mousePos.y * 4}px, 0)`,
          }}
        >
          <div className="absolute top-4 left-4 text-[10px] font-mono tracking-widest text-white/30 uppercase font-semibold">
            ZONE · INTERNET (DEPTH: 0)
          </div>
        </div>

        {/* Layer 2: DMZ (Middle, parallax 8px) */}
        <div
          className="w-1/3 h-full border-r border-white/5 transition-transform duration-75 ease-out relative"
          style={{
            backgroundColor: "rgba(14, 20, 25, 0.65)",
            transform: `translate3d(${mousePos.x * 8}px, ${mousePos.y * 8}px, 0)`,
          }}
        >
          <div className="absolute top-4 left-4 text-[10px] font-mono tracking-widest text-white/30 uppercase font-semibold">
            ZONE · DMZ (DEPTH: -1)
          </div>
        </div>

        {/* Layer 3: Internal (Deepest & darkest, parallax 12px) */}
        <div
          className="w-1/3 h-full transition-transform duration-75 ease-out relative"
          style={{
            backgroundColor: "rgba(9, 13, 17, 0.9)",
            transform: `translate3d(${mousePos.x * 12}px, ${mousePos.y * 12}px, 0)`,
          }}
        >
          <div className="absolute top-4 left-4 text-[10px] font-mono tracking-widest text-white/30 uppercase font-semibold">
            ZONE · INTERNAL CORE (DEPTH: -2)
          </div>
        </div>
      </div>

      {/* 24px Technical Grid */}
      <div className="absolute inset-0 stage-grid pointer-events-none opacity-40 z-0" />

      {/* Interactive Cytoscape Canvas Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-10 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Hover Tooltip */}
      {hoverTooltip && (
        <div
          className="absolute z-40 pointer-events-none bg-stage-card/95 border border-white/15 px-3 py-2 rounded-xl text-stage-text text-xs font-mono shadow-stage backdrop-blur-md transition-all duration-75"
          style={{
            left: `${hoverTooltip.x}px`,
            top: `${hoverTooltip.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-bold text-white flex items-center gap-1.5">
            {hoverTooltip.type === "node" ? (
              <span className="w-2 h-2 rounded-full bg-copper" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-threat" />
            )}
            <span>{hoverTooltip.title}</span>
          </div>
          <div className="text-[10px] text-stage-text-2 mt-0.5">
            {hoverTooltip.subtitle}
          </div>
          {hoverTooltip.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {hoverTooltip.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.2 rounded bg-white/10 text-[9px] text-white/80 border border-white/5"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HUD Overlay (Top-Left) */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto bg-stage-card/90 backdrop-blur-md border border-white/10 rounded-xl p-3.5 shadow-stage text-stage-text min-w-[280px]">
        <div className="text-[10px] font-mono uppercase tracking-widest text-stage-text-2 mb-1.5 flex items-center justify-between">
          <span>SPECIMEN ANALYSIS HUD</span>
          {bundle?.status === "verified" && (
            <span className="text-[10px] text-verified-stage font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> VERIFIED
            </span>
          )}
          {bundle?.status === "no_modeled_paths" && (
            <span className="text-[10px] text-caution-stage font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> NO PATHS
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 py-1 border-t border-b border-white/5 my-1.5">
          <div>
            <div className="text-[10px] font-mono text-stage-text-2">
              MODELED ATTACK PATHS
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl font-bold text-white tabular-nums">
                {animatedPaths}
              </span>
              {isVerifiedPlanShown && pathsBefore > 0 && (
                <span className="text-xs font-mono text-stage-text-2 line-through">
                  was {pathsBefore}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-stage-text-2">
              REMEDIATION PLAN
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-3xl font-bold text-copper-stage tabular-nums">
                {patchCount}
              </span>
              <span className="text-xs font-mono text-stage-text-2">
                {patchCount === 1 ? "patch" : "patches"}
              </span>
            </div>
          </div>
        </div>

        {/* Path Reduction Explainer (Law 2 compliance) */}
        <div className="text-[11px] font-mono text-stage-text-2 mt-2 leading-relaxed">
          <span className="text-white font-medium">Modeled path reduction: </span>
          {pathsBefore === 0 ? (
            <span className="text-caution-stage">Not applicable (0 paths before)</span>
          ) : isVerifiedPlanShown ? (
            <span className="text-verified-stage font-bold">100% (bounded graph)</span>
          ) : (
            <span>0% (pending plan execution)</span>
          )}
          <div className="text-[10px] text-stage-text-2/70 mt-0.5">
            Path-count metric for bounded modeled graph, not total organizational risk.
          </div>
        </div>

        {/* Illustrative baseline comparison */}
        {baseline && (
          <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] font-mono text-stage-text-2 flex items-center justify-between">
            <span>Illustrative baseline:</span>
            <span className="text-white">
              All candidates: {baseline.candidate_patches} (${baseline.candidate_cost}) vs Plan: {baseline.plan_patches} (${baseline.plan_cost})
            </span>
          </div>
        )}
      </div>

      {/* Stage Interactive View Filter Bar (Top-Center) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-stage-card/90 backdrop-blur-md border border-white/10 rounded-xl p-1 text-xs font-mono flex items-center gap-1 shadow-stage">
        {(
          [
            { id: "all", label: "All Elements" },
            { id: "attack_path", label: "Attack Path" },
            { id: "cut_edges", label: "Cut Edges" },
            { id: "crown_jewels", label: "Crown Jewels" },
          ] as { id: GraphFilterType; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveGraphFilter(tab.id)}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeGraphFilter === tab.id
                ? "bg-copper-stage text-ink font-bold shadow-subtle"
                : "text-stage-text-2 hover:text-stage-text hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* Attack Pulse Action */}
        <button
          onClick={handleAnimateAttackFlow}
          disabled={isAttackPulsing}
          title="Trace active attack flow through modeled graph"
          className="px-2.5 py-1 rounded-lg text-copper-stage hover:bg-copper-stage/20 transition-colors flex items-center gap-1 font-bold disabled:opacity-50"
        >
          <Zap className={`w-3.5 h-3.5 ${isAttackPulsing ? "animate-bounce" : ""}`} />
          <span>Pulse Attack</span>
        </button>
      </div>

      {/* Floating Edge Detail Card (when an edge is selected) */}
      {selectedEdge && (
        <div className="absolute top-20 right-4 z-30 pointer-events-auto bg-stage-card/95 border border-copper/40 rounded-2xl p-4 shadow-stage text-stage-text min-w-[320px] max-w-sm backdrop-blur-lg animate-scale-in">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-threat animate-ping" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-copper-stage font-bold">
                ATTACK VECTOR DETAIL
              </span>
            </div>
            <button
              onClick={() => selectEdge(null)}
              className="p-1 rounded hover:bg-white/10 text-stage-text-2 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-3 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="text-[10px] text-stage-text-2 uppercase">Topology Traversal</div>
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <button
                  onClick={() => selectAsset(selectedEdge.source)}
                  className="hover:text-copper-stage underline underline-offset-2"
                >
                  {selectedEdge.source}
                </button>
                <span className="text-stage-text-2">→</span>
                <button
                  onClick={() => selectAsset(selectedEdge.target)}
                  className="hover:text-copper-stage underline underline-offset-2"
                >
                  {selectedEdge.target}
                </button>
              </div>
              <div className="text-[11px] text-stage-text-2">
                Target Port: {selectedEdge.ports?.length ? `:${selectedEdge.ports.join(", ")}` : "Any"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] text-stage-text-2 uppercase">Classification & Mitigation</div>
              <div className="flex items-center justify-between">
                <span className="text-stage-text-2">Path Status:</span>
                {selectedEdge.isOnModeledPath ? (
                  <span className="text-threat font-bold">Active Modeled Path</span>
                ) : (
                  <span className="text-stage-text-2">Lateral Reach</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stage-text-2">Min-Cut Target:</span>
                {selectedEdge.isCut ? (
                  <span className="text-verified-stage font-bold bg-verified-stage/20 px-1.5 py-0.5 rounded">
                    INTERRUPTED BY PLAN
                  </span>
                ) : (
                  <span className="text-stage-text-2">Uncut</span>
                )}
              </div>

              {selectedEdge.patchIds?.length > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-stage-text-2">Required Patch:</span>
                  <span className="text-copper-stage font-bold">{selectedEdge.patchIds[0]}</span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setActiveInspectorTab("plan");
                  if (selectedEdge.patchIds?.[0]) {
                    useConsoleStore.getState().selectPatch(selectedEdge.patchIds[0]);
                  }
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white/10 hover:bg-copper-stage hover:text-ink text-white text-[11px] font-bold transition-all text-center"
              >
                Inspect in Plan
              </button>
              <button
                onClick={() => {
                  selectAsset(selectedEdge.target);
                  setActiveInspectorTab("asset");
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/15 text-stage-text text-[11px] transition-colors text-center"
              >
                Inspect Target Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Choreography Status Toast / Glint Overlay */}
      {animStageCaption && (
        <div className="absolute top-4 right-4 z-30 pointer-events-auto bg-ink/95 border border-copper/40 text-paper px-4 py-2 rounded-xl text-xs font-mono shadow-stage flex items-center gap-2 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-copper-stage animate-spin" />
          <span>{animStageCaption}</span>
          <span className="text-[10px] text-paper/60 ml-2">(Esc to skip)</span>
        </div>
      )}

      {/* Floating Canvas Controls (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 bg-stage-card/90 backdrop-blur-md border border-white/10 rounded-lg p-1 text-stage-text shadow-stage pointer-events-auto">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 rounded hover:bg-white/10 text-stage-text transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 rounded hover:bg-white/10 text-stage-text transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFit}
          title="Fit view to graph (F)"
          className="p-1.5 rounded hover:bg-white/10 text-stage-text transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          title="Reset layout"
          className="p-1.5 rounded hover:bg-white/10 text-stage-text transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <button
          onClick={toggleShowReachEdges}
          title="Toggle network reachability overlay"
          className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 transition-colors ${
            showReachEdges ? "bg-copper-stage/20 text-copper-stage" : "hover:bg-white/10 text-stage-text-2"
          }`}
        >
          {showReachEdges ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>Reachability</span>
        </button>
      </div>

      {/* Bottom Remediation Action Dock */}
      {bundle && (
        <div className="absolute bottom-4 right-4 z-20 pointer-events-auto flex items-center gap-3">
          {bundle.status === "verified" && (
            <div className="flex items-center gap-2">
              <button
                onClick={isVerifiedPlanShown ? () => setIsVerifiedPlanShown(false) : startChoreography}
                disabled={isChoreographing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-xl bg-verified-stage text-ink hover:bg-verified-stage/90 active:scale-[0.98] transition-all shadow-stage focus:outline-none focus:ring-2 focus:ring-verified-stage focus:ring-offset-2 focus:ring-offset-stage-bg disabled:opacity-50"
              >
                {isVerifiedPlanShown ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>RESET TO BEFORE STATE (SPACE)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>SHOW VERIFIED PLAN (SPACE)</span>
                  </>
                )}
              </button>

              {isVerifiedPlanShown && (
                <button
                  onClick={startChoreography}
                  disabled={isChoreographing}
                  className="px-3 py-2 text-xs font-mono rounded-xl bg-stage-card border border-white/10 text-stage-text hover:bg-white/10 transition-colors"
                  title="Replay 7-second choreography"
                >
                  Replay
                </button>
              )}
            </div>
          )}

          {bundle.status === "no_modeled_paths" && (
            <div className="px-3 py-1.5 rounded-lg bg-caution-stage/15 border border-caution-stage/30 text-caution-stage font-mono text-xs flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>No modeled attack path to cut (Fail-closed safety)</span>
            </div>
          )}
        </div>
      )}

      {/* Empty State / Ghost Stage before run */}
      {!bundle && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-stage-card/95 border border-white/10 p-6 rounded-2xl max-w-md text-center shadow-stage pointer-events-auto">
            <div className="w-12 h-12 rounded-xl bg-copper/10 border border-copper/20 text-copper-stage flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-bold text-white mb-1">
              Specimen Stage Ready
            </h3>
            <p className="text-xs font-mono text-stage-text-2 leading-relaxed mb-4">
              Select a lab and mode, then click <strong className="text-white">Run analysis</strong> to review findings, construct the evidence-bounded graph, and solve min-cut remediation.
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-stage-text-2">
              <span className="px-2 py-1 rounded bg-white/5 border border-white/5">
                Lab A: 3-tier architecture
              </span>
              <span className="px-2 py-1 rounded bg-white/5 border border-white/5">
                Demo: MariaDB cut
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
