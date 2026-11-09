import { Asset, GraphData, PlanPayload, DerivedData, Reach } from "./types";

export interface CyNodeElement {
  group: "nodes";
  data: {
    id: string;
    label: string;
    ip: string;
    zone: string;
    criticality: number;
    isEntryPoint: boolean;
    isCrownJewel: boolean;
    findingsCount: number;
    role: string;
  };
  position: { x: number; y: number };
}

export interface CyEdgeElement {
  group: "edges";
  data: {
    id: string;
    source: string;
    target: string;
    ports: number[];
    patchIds: string[];
    patchCost: number;
    label: string;
    isOnModeledPath: boolean;
    isCut: boolean;
    isReachOnly: boolean;
  };
}

export type CyElement = CyNodeElement | CyEdgeElement;

const ZONE_X_CENTERS: Record<string, number> = {
  internet: 180,
  dmz: 500,
  internal: 820,
};

function getRoleFromId(id: string): string {
  const lower = id.toLowerCase();
  if (lower.startsWith("web")) return "web";
  if (lower.startsWith("app")) return "app";
  if (lower.startsWith("db")) return "database";
  if (lower.startsWith("file")) return "file";
  if (lower.startsWith("jump")) return "jumpbox";
  if (lower.startsWith("decoy")) return "decoy";
  return "server";
}

export function transformToCytoscape(
  assets: Asset[],
  graph: GraphData,
  plan: PlanPayload,
  derived: DerivedData,
  reach: Reach[] = [],
  includeReachEdges = false
): CyElement[] {
  const elements: CyElement[] = [];

  // Group assets by zone
  const assetsByZone: Record<string, Asset[]> = {
    internet: [],
    dmz: [],
    internal: [],
  };

  assets.forEach((asset) => {
    const z = (asset.zone || "internet").toLowerCase();
    if (!assetsByZone[z]) assetsByZone[z] = [];
    assetsByZone[z].push(asset);
  });

  // Sort each zone: entry points first, crown jewels last
  Object.keys(assetsByZone).forEach((zone) => {
    assetsByZone[zone].sort((a, b) => {
      if (a.is_entry_point && !b.is_entry_point) return -1;
      if (!a.is_entry_point && b.is_entry_point) return 1;
      if (a.is_crown_jewel && !b.is_crown_jewel) return 1;
      if (!a.is_crown_jewel && b.is_crown_jewel) return -1;
      return a.id.localeCompare(b.id);
    });
  });

  // Calculate coordinates
  Object.entries(assetsByZone).forEach(([zone, zoneAssets]) => {
    const centerX = ZONE_X_CENTERS[zone] ?? 500;
    const count = zoneAssets.length;
    const startY = 140;
    const spacingY = count > 1 ? Math.min(180, 520 / Math.max(count - 1, 1)) : 0;

    zoneAssets.forEach((asset, idx) => {
      const posY = count === 1 ? 320 : startY + idx * spacingY;

      // Count reviewed findings on this asset
      const graphNode = graph.nodes.find((n) => n.id === asset.id);

      elements.push({
        group: "nodes",
        data: {
          id: asset.id,
          label: asset.id,
          ip: asset.ip,
          zone: asset.zone,
          criticality: asset.criticality || 5,
          isEntryPoint: Boolean(asset.is_entry_point),
          isCrownJewel: Boolean(asset.is_crown_jewel),
          findingsCount: 0,
          role: getRoleFromId(asset.id),
        },
        position: { x: centerX, y: posY },
      });
    });
  });

  // Check which edges are on modeled paths in plan.paths
  // A path is an array of node ids: ["web01", "app01", "db01"]
  const modeledPathEdges = new Set<string>();
  if (plan.paths && Array.isArray(plan.paths)) {
    plan.paths.forEach((path) => {
      for (let i = 0; i < path.length - 1; i++) {
        modeledPathEdges.add(`${path[i]}->${path[i + 1]}`);
      }
    });
  }

  // Check cut edges from derived.cut_edges
  const cutEdgePairs = new Set<string>();
  if (derived.cut_edges && Array.isArray(derived.cut_edges)) {
    derived.cut_edges.forEach((ce) => {
      cutEdgePairs.add(`${ce.src}->${ce.dst}`);
    });
  }

  // Add graph attack edges
  const renderedEdgePairs = new Set<string>();
  graph.edges.forEach((edge) => {
    const pairKey = `${edge.src}->${edge.dst}`;
    renderedEdgePairs.add(pairKey);

    const isOnPath = modeledPathEdges.has(pairKey);
    const isCut = cutEdgePairs.has(pairKey);
    const portsStr = edge.ports && edge.ports.length ? `:${edge.ports.join(",")}` : "";
    const patchId = edge.patch_ids && edge.patch_ids.length ? edge.patch_ids[0] : "";
    const edgeLabel = `${portsStr} [${patchId}]`;

    elements.push({
      group: "edges",
      data: {
        id: `attack-${edge.src}-${edge.dst}`,
        source: edge.src,
        target: edge.dst,
        ports: edge.ports || [],
        patchIds: edge.patch_ids || [],
        patchCost: edge.patch_cost || 1,
        label: edgeLabel,
        isOnModeledPath: isOnPath,
        isCut,
        isReachOnly: false,
      },
    });
  });

  // Optional: add reachability edges that don't already have attack edges
  if (includeReachEdges && reach) {
    reach.forEach((r, idx) => {
      const pairKey = `${r.src}->${r.dst}`;
      if (!renderedEdgePairs.has(pairKey)) {
        elements.push({
          group: "edges",
          data: {
            id: `reach-${r.src}-${r.dst}-${r.port}-${idx}`,
            source: r.src,
            target: r.dst,
            ports: [r.port],
            patchIds: [],
            patchCost: 0,
            label: `:${r.port}`,
            isOnModeledPath: false,
            isCut: false,
            isReachOnly: true,
          },
        });
      }
    });
  }

  return elements;
}
