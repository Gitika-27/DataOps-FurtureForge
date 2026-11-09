export type ZoneType = "internet" | "dmz" | "internal";
export type RunStatus = "verified" | "no_modeled_paths" | "invalid";
export type VerdictStatus = "confirmed" | "downgraded" | "rejected";
export type RunMode = "demo" | "mock" | "live";
export type RunLab = "lab_a" | "lab_b";

export interface HealthResponse {
  status: string;
  version: string;
  live_enabled: boolean;
  live_reason: string;
}

export interface Asset {
  id: string;
  ip: string;
  zone: ZoneType;
  criticality: number;
  is_crown_jewel: boolean;
  is_entry_point: boolean;
}

export interface Service {
  asset_id: string;
  port: number;
  name: string;
  version: string;
}

export interface Reach {
  src: string;
  dst: string;
  port: number;
}

export interface RawFinding {
  id: string;
  asset_id: string;
  port: number;
  port_context?: string;
  suggested_ports?: number[];
  cve: string;
  cvss: number;
  severity?: string;
  package_name?: string;
  installed_version?: string;
  fixed_version?: string;
  title?: string;
  source?: string;
  remote_exploitable?: boolean | null;
  patch_id: string;
  patch_cost: number;
}

export interface Verdict {
  finding_id: string;
  status: VerdictStatus;
  confidence: number;
  evidence: string[];
  reasoning: string;
}

export interface ReviewedFinding {
  id: string;
  asset_id: string;
  port: number;
  cve: string;
  cvss: number;
  epss?: number | null;
  in_kev: boolean;
  remote_exploitable: boolean;
  patch_id: string;
  patch_cost: number;
}

export interface GraphNode {
  id: string;
  ip?: string;
  zone?: ZoneType;
  criticality?: number;
  is_entry_point?: boolean;
  is_crown_jewel?: boolean;
}

export interface GraphEdge {
  src: string;
  dst: string;
  patch_id?: string;
  patch_ids: string[];
  patch_costs?: Record<string, number>;
  patch_cost?: number;
  finding_ids: string[];
  ports: number[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PlanContent {
  patches: string[];
  paths_before: number;
  paths_after: number;
  risk_reduction_pct: number;
}

export interface VerificationData {
  valid: boolean;
  paths_before: number;
  paths_after: number;
  remaining_paths?: string[][];
}

export interface PlanPayload {
  lab_id: string;
  status: RunStatus;
  warning?: string | null;
  plan: PlanContent;
  verification: VerificationData;
  paths: string[][];
}

export interface SkepticResult {
  status: RunStatus;
  warning?: string | null;
  verdict_count: number;
  graph_finding_count: number;
  graph_node_count?: number;
  graph_edge_count?: number;
  paths_before: number;
  paths_after: number;
  patches: string[];
}

export interface CutEdge {
  src: string;
  dst: string;
}

export interface BaselineMetrics {
  candidate_patches: number;
  candidate_cost: number;
  plan_patches: number;
  plan_cost: number;
}

export interface DerivedData {
  max_hops: number;
  cut_edges: CutEdge[];
  baseline: BaselineMetrics | null;
}

export interface ArtifactFlags {
  report_html: boolean;
  report_pdf: boolean;
}

export interface RunBundle {
  run_id: string;
  lab: RunLab;
  mode: RunMode;
  source: "engine" | "snapshot";
  status: RunStatus;
  error?: string | null;
  synthetic: boolean;
  notes: string[];
  created_at: string;
  assets: Asset[];
  services: Service[];
  reach: Reach[];
  raw_findings: RawFinding[];
  verdicts: Verdict[];
  reviewed_findings: ReviewedFinding[];
  graph: GraphData;
  plan: PlanPayload;
  skeptic_result: SkepticResult;
  derived: DerivedData;
  artifacts: ArtifactFlags;
}
