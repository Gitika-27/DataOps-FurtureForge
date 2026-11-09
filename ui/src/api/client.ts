import { HealthResponse, RunBundle, RunLab, RunMode } from "./types";

const API_BASE = ""; // Relative proxy in Vite, or served by FastAPI in prod

export async function checkHealth(): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function executeRunApi(lab: RunLab, mode: RunMode): Promise<RunBundle> {
  const res = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lab, mode }),
  });

  if (!res.ok) {
    let msg = `HTTP error ${res.status}`;
    try {
      const errJson = await res.json();
      msg = errJson.message || errJson.detail || msg;
    } catch {
      // no-op
    }
    throw new Error(msg);
  }

  return res.json();
}

export async function fetchRunById(runId: string): Promise<RunBundle> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}`);
  if (!res.ok) {
    throw new Error(`Run ${runId} not found (${res.status})`);
  }
  return res.json();
}

export async function fetchSnapshotFallback(): Promise<RunBundle> {
  const res = await fetch(`/snapshots/demo_lab_a.bundle.json`);
  if (!res.ok) {
    throw new Error("Local snapshot file could not be loaded");
  }
  return res.json();
}
