import { create } from "zustand";
import { RunBundle, RunLab, RunMode, VerdictStatus } from "@/api/types";

export type GraphFilterType = "all" | "attack_path" | "crown_jewels" | "cut_edges";
export type AssetFilterChipType = "all" | "crown" | "entry" | "vulnerable";

interface ConsoleState {
  lab: RunLab;
  mode: RunMode;
  bundle: RunBundle | null;
  loading: boolean;
  error: string | null;

  selectedAssetId: string | null;
  selectedFindingId: string | null;
  selectedPatchId: string | null;
  selectedEdge: any | null;
  hoveredAssetId: string | null;
  hoveredEdgeId: string | null;

  activeInspectorTab: "plan" | "skeptic" | "asset";
  skepticStatusFilter: VerdictStatus | "all";
  skepticSearch: string;
  showReachEdges: boolean;
  isVerifiedPlanShown: boolean;
  isLimitationsOpen: boolean;
  isKeyboardShortcutsOpen: boolean;
  guidedDemoStep: number | null;
  activeGraphFilter: GraphFilterType;
  assetFilterChip: AssetFilterChipType;

  setLab: (lab: RunLab) => void;
  setMode: (mode: RunMode) => void;
  setBundle: (bundle: RunBundle | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  selectAsset: (assetId: string | null) => void;
  selectFinding: (findingId: string | null) => void;
  selectPatch: (patchId: string | null) => void;
  selectEdge: (edgeData: any | null) => void;
  setHoveredAssetId: (id: string | null) => void;
  setHoveredEdgeId: (id: string | null) => void;

  setActiveInspectorTab: (tab: "plan" | "skeptic" | "asset") => void;
  setSkepticStatusFilter: (filter: VerdictStatus | "all") => void;
  setSkepticSearch: (query: string) => void;
  toggleShowReachEdges: () => void;
  setIsVerifiedPlanShown: (shown: boolean) => void;
  setLimitationsOpen: (open: boolean) => void;
  setKeyboardShortcutsOpen: (open: boolean) => void;
  setGuidedDemoStep: (step: number | null) => void;
  setActiveGraphFilter: (filter: GraphFilterType) => void;
  setAssetFilterChip: (filter: AssetFilterChipType) => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  lab: "lab_a",
  mode: "demo",
  bundle: null,
  loading: false,
  error: null,

  selectedAssetId: null,
  selectedFindingId: null,
  selectedPatchId: null,
  selectedEdge: null,
  hoveredAssetId: null,
  hoveredEdgeId: null,

  activeInspectorTab: "plan",
  skepticStatusFilter: "all",
  skepticSearch: "",
  showReachEdges: false,
  isVerifiedPlanShown: false,
  isLimitationsOpen: false,
  isKeyboardShortcutsOpen: false,
  guidedDemoStep: null,
  activeGraphFilter: "all",
  assetFilterChip: "all",

  setLab: (lab) => set({ lab, selectedAssetId: null, selectedEdge: null }),
  setMode: (mode) => set({ mode }),
  setBundle: (bundle) =>
    set({
      bundle,
      isVerifiedPlanShown: false,
      selectedAssetId: null,
      selectedFindingId: null,
      selectedPatchId: null,
      selectedEdge: null,
      error: null,
    }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  selectAsset: (assetId) =>
    set({
      selectedAssetId: assetId,
      selectedEdge: null,
      activeInspectorTab: "asset",
    }),
  selectFinding: (findingId) =>
    set({
      selectedFindingId: findingId,
      activeInspectorTab: "skeptic",
    }),
  selectPatch: (patchId) =>
    set({
      selectedPatchId: patchId,
      activeInspectorTab: "plan",
    }),
  selectEdge: (edgeData) =>
    set({
      selectedEdge: edgeData,
      selectedAssetId: null,
    }),
  setHoveredAssetId: (id) => set({ hoveredAssetId: id }),
  setHoveredEdgeId: (id) => set({ hoveredEdgeId: id }),

  setActiveInspectorTab: (tab) => set({ activeInspectorTab: tab }),
  setSkepticStatusFilter: (filter) => set({ skepticStatusFilter: filter }),
  setSkepticSearch: (query) => set({ skepticSearch: query }),
  toggleShowReachEdges: () =>
    set((state) => ({ showReachEdges: !state.showReachEdges })),
  setIsVerifiedPlanShown: (shown) => set({ isVerifiedPlanShown: shown }),
  setLimitationsOpen: (open) => set({ isLimitationsOpen: open }),
  setKeyboardShortcutsOpen: (open) => set({ isKeyboardShortcutsOpen: open }),
  setGuidedDemoStep: (step) => set({ guidedDemoStep: step }),
  setActiveGraphFilter: (filter) => set({ activeGraphFilter: filter }),
  setAssetFilterChip: (filter) => set({ assetFilterChip: filter }),
}));
