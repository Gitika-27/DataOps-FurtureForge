import { describe, it, expect } from "vitest";
import { transformToCytoscape } from "./toCytoscape";
import { Asset, GraphData, PlanPayload, DerivedData } from "./types";

describe("transformToCytoscape", () => {
  const mockAssets: Asset[] = [
    { id: "web01", ip: "172.20.0.2", zone: "internet", criticality: 8, is_crown_jewel: false, is_entry_point: true },
    { id: "app01", ip: "172.21.0.2", zone: "dmz", criticality: 7, is_crown_jewel: false, is_entry_point: false },
    { id: "db01", ip: "172.22.0.2", zone: "internal", criticality: 10, is_crown_jewel: true, is_entry_point: false },
  ];

  const mockGraph: GraphData = {
    nodes: [
      { id: "web01", ip: "172.20.0.2", zone: "internet" },
      { id: "app01", ip: "172.21.0.2", zone: "dmz" },
      { id: "db01", ip: "172.22.0.2", zone: "internal" },
    ],
    edges: [
      {
        src: "web01",
        dst: "app01",
        patch_ids: ["p-web"],
        finding_ids: ["f1"],
        ports: [80],
        patch_cost: 2,
      },
      {
        src: "app01",
        dst: "db01",
        patch_ids: ["p-db"],
        finding_ids: ["f2"],
        ports: [3306],
        patch_cost: 1,
      },
    ],
  };

  const mockPlan: PlanPayload = {
    lab_id: "lab_a",
    status: "verified",
    plan: {
      patches: ["p-db"],
      paths_before: 1,
      paths_after: 0,
      risk_reduction_pct: 100,
    },
    verification: {
      valid: true,
      paths_before: 1,
      paths_after: 0,
    },
    paths: [["web01", "app01", "db01"]],
  };

  const mockDerived: DerivedData = {
    max_hops: 8,
    cut_edges: [{ src: "app01", dst: "db01" }],
    baseline: {
      candidate_patches: 2,
      candidate_cost: 3,
      plan_patches: 1,
      plan_cost: 1,
    },
  };

  it("produces Cytoscape nodes positioned along 3 depth zone lanes", () => {
    const elements = transformToCytoscape(mockAssets, mockGraph, mockPlan, mockDerived);
    const nodes = elements.filter((el) => el.group === "nodes");
    expect(nodes.length).toBe(3);

    const webNode = nodes.find((n) => n.data.id === "web01")!;
    expect(webNode.position.x).toBe(180); // Internet lane center
    expect(webNode.data.isEntryPoint).toBe(true);

    const appNode = nodes.find((n) => n.data.id === "app01")!;
    expect(appNode.position.x).toBe(500); // DMZ lane center

    const dbNode = nodes.find((n) => n.data.id === "db01")!;
    expect(dbNode.position.x).toBe(820); // Internal lane center
    expect(dbNode.data.isCrownJewel).toBe(true);
  });

  it("flags cut edges and modeled attack paths correctly", () => {
    const elements = transformToCytoscape(mockAssets, mockGraph, mockPlan, mockDerived);
    const edges = elements.filter((el) => el.group === "edges");
    expect(edges.length).toBe(2);

    const webToApp = edges.find((e) => e.data.source === "web01" && e.data.target === "app01")!;
    expect(webToApp.data.isOnModeledPath).toBe(true);
    expect(webToApp.data.isCut).toBe(false);

    const appToDb = edges.find((e) => e.data.source === "app01" && e.data.target === "db01")!;
    expect(appToDb.data.isOnModeledPath).toBe(true);
    expect(appToDb.data.isCut).toBe(true);
  });
});
