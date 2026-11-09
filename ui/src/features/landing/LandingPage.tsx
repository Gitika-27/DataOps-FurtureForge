import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Shield,
  Layers,
  Wrench,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Play,
  Sparkles,
  Search,
  Lock,
  RotateCcw,
  Zap,
  ChevronDown,
  ChevronRight,
  Code2,
  Server,
  Database,
  Globe,
  Terminal,
  ExternalLink,
  Cpu,
  BarChart3,
  HelpCircle,
  Check,
  X,
} from "lucide-react";
import { useConsoleStore } from "../console/useConsoleStore";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setGuidedDemoStep, setLab, setMode } = useConsoleStore();
  const [scrollProgress, setScrollProgress] = useState(0);

  // Hero interactive toggle
  const [heroView, setHeroView] = useState<"conventional" | "futureforge">("futureforge");

  // Interactive Diamond Min-Cut Simulator State
  const [activePatches, setActivePatches] = useState<Set<string>>(new Set(["p3"]));

  // Pipeline Explorer active step
  const [activePipelineStep, setActivePipelineStep] = useState<number>(3);

  // Evidence Specimen active tab
  const [activeSpecimen, setActiveSpecimen] = useState<"finding" | "verdict" | "graph" | "plan">("plan");

  // FAQ open states
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const togglePatch = (patchId: string) => {
    setActivePatches((prev) => {
      const next = new Set(prev);
      if (next.has(patchId)) {
        next.delete(patchId);
      } else {
        next.add(patchId);
      }
      return next;
    });
  };

  const hasP1 = activePatches.has("p1");
  const hasP2 = activePatches.has("p2");
  const hasP3 = activePatches.has("p3");

  const isPathAActive = !hasP1 && !hasP3;
  const isPathBActive = !hasP2 && !hasP3;
  const activePathsCount = (isPathAActive ? 1 : 0) + (isPathBActive ? 1 : 0);

  const totalCost =
    (hasP1 ? 3 : 0) +
    (hasP2 ? 3 : 0) +
    (hasP3 ? 1 : 0);

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0) {
        setScrollProgress(Math.min(window.scrollY / total, 1));
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleStartDemo = () => {
    setGuidedDemoStep(1);
    navigate("/console");
  };

  const pipelineStages = [
    {
      id: 0,
      title: "1. Scanner Ingestion",
      owner: "Person 1",
      tagline: "Normalize heterogeneous scanner findings into immutable Pydantic models",
      code: `class Finding(BaseModel):\n  id: str\n  asset_id: str\n  port: int\n  cve: str\n  cvss: float\n  remote_exploitable: bool`,
      input: "Nmap XML + Trivy JSON + Host inventory",
      output: "contracts/models.py (Finding, Asset, Service)",
    },
    {
      id: 1,
      title: "2. Deterministic Skeptic Review",
      owner: "Person 3",
      tagline: "Disqualify non-viable findings via 6 deterministic identity & reachability checks",
      code: `def evaluate_finding(f, asset, services, reach, nvd):\n  # 1. Target asset exists\n  # 2. Service identity & version match\n  # 3. Port observed in scan\n  # 4. Topology reachability\n  # 5. NVD CPE version applicability\n  # 6. NVD network vector (AV:N)`,
      input: "Raw findings + scan telemetry + NVD cache",
      output: "verdicts.json (confirmed | downgraded | rejected)",
    },
    {
      id: 2,
      title: "3. Evidence-Bounded Attack Graph",
      owner: "Person 2",
      tagline: "Construct directed multigraph where edges exist only with confirmed remote exploitability",
      code: `G = nx.DiGraph()\nfor edge in reach:\n  if finding.remote_exploitable and edge.port == finding.port:\n    G.add_edge(edge.src, edge.dst, patches=[finding.patch_id])`,
      input: "Reviewed findings + reachability tuples",
      output: "graph.json (NetworkX DiGraph representation)",
    },
    {
      id: 3,
      title: "4. Min-Cut ILP Optimizer",
      owner: "Person 2",
      tagline: "Solve binary integer program minimizing cost while cutting every path to crown jewels",
      code: `prob = pulp.LpProblem("PatchMinCut", pulp.LpMinimize)\nprob += pulp.lpSum(c[p] * x[p] for p in patches)\nfor path in all_simple_paths(G, entry, crown, cutoff=8):\n  prob += pulp.lpSum(x[p] for e in path for p in e.patches) >= 1`,
      input: "Attack graph + entry points + crown jewels",
      output: "plan.json (selected patches + paths before/after)",
    },
    {
      id: 4,
      title: "5. Independent Verification",
      owner: "Person 2",
      tagline: "Verify plan against a freshly cloned graph copy; enforce paths_after == 0",
      code: `G_copy = nx.DiGraph(G_original)\nG_copy = apply_patches(G_copy, plan.patches)\npaths_after = list(nx.all_simple_paths(G_copy, entry, crown, cutoff=8))\nassert len(paths_after) == 0 # Verification Invariant`,
      input: "Original graph + proposed patch set",
      output: "status: verified | no_modeled_paths | invalid",
    },
    {
      id: 5,
      title: "6. Evidence Ledger Report",
      owner: "Person 3 & 4",
      tagline: "Generate immutable audit ledger and signed PDF with full provenance",
      code: `html = render_template("report.html", run=run_bundle)\nif create_pdf:\n  pisa.CreatePDF(html, dest=pdf_file)`,
      input: "Complete run bundle + verification verdict",
      output: "report.html + report.pdf (Jinja2 / xhtml2pdf)",
    },
  ];

  const specimens = {
    finding: {
      title: "Raw Scanner Finding (ingest/)",
      lang: "json",
      content: `{\n  "id": "finding-lab-a-mariadb-001",\n  "asset_id": "db01",\n  "port": 3306,\n  "cve": "CVE-2099-1001",\n  "cvss": 9.8,\n  "epss": 0.94,\n  "remote_exploitable": true,\n  "patch_id": "demo-db-fix",\n  "patch_cost": 25\n}`,
    },
    verdict: {
      title: "Skeptic Verdict Ledger (skeptic/)",
      lang: "json",
      content: `{\n  "finding_id": "finding-lab-a-mariadb-001",\n  "status": "confirmed",\n  "confidence": 0.95,\n  "reasoning": "Confirmed remote attack vector: MariaDB 10.5.8 matches vulnerable CPE, port 3306 observed open, reachable from app01.",\n  "evidence": [\n    "scanner reports CVE-2099-1001 on db01:3306",\n    "nmap observed open port 3306 on db01",\n    "topology records reachability app01 -> db01:3306",\n    "nvd vulnerable cpe matches installed mariadb 10.5.8",\n    "nvd cvss vector identifies network vector (AV:N)"\n  ]\n}`,
    },
    graph: {
      title: "Attack Graph Edges (core/graph.py)",
      lang: "json",
      content: `{\n  "nodes": [\n    {"id": "web01", "zone": "internet", "is_entry_point": true},\n    {"id": "app01", "zone": "dmz", "is_entry_point": false},\n    {"id": "db01", "zone": "internal", "is_crown_jewel": true}\n  ],\n  "edges": [\n    {"src": "web01", "dst": "app01", "ports": [8080], "patch_ids": ["app-auth-fix"]},\n    {"src": "app01", "dst": "db01", "ports": [3306], "patch_ids": ["demo-db-fix"]}\n  ]\n}`,
    },
    plan: {
      title: "Verified Min-Cut Plan (core/verify.py)",
      lang: "json",
      content: `{\n  "status": "verified",\n  "plan": {\n    "patches": ["demo-db-fix"],\n    "paths_before": 1,\n    "paths_after": 0,\n    "risk_reduction_pct": 100.0\n  },\n  "baseline": {\n    "candidate_patches": 2,\n    "candidate_cost": 50,\n    "plan_patches": 1,\n    "plan_cost": 25,\n    "savings_pct": 50.0\n  }\n}`,
    },
  };

  const faqs = [
    {
      q: "Why not just patch the highest CVSS vulnerabilities first?",
      a: "CVSS measures theoretical severity in isolation without considering network topology. An unpatched CVSS 9.8 vulnerability on an isolated internal server with no inbound reachability poses zero immediate threat of external compromise. FutureForge models reachability paths to designated crown jewels, focusing resources where attacks can actually execute.",
    },
    {
      q: "How does the Skeptic Agent verify vulnerabilities without running exploits?",
      a: "The Skeptic is strictly non-adversarial and deterministic. It evaluates 6 concrete evidence requirements: (1) target host exists in inventory, (2) installed service identity and exact version match, (3) target port was observed open by Nmap, (4) network topology records an active path, (5) NVD CPE version ranges match, and (6) NVD CVSS vector specifies Network (AV:N). If any check fails, the finding is downgraded or rejected.",
    },
    {
      q: "What is the mathematical formulation of the Min-Cut Planner?",
      a: "We formulate remediation as a minimum-cost hitting set problem solved via PuLP and the CBC integer linear programming solver. Every modeled simple path from an entry point to a crown jewel defines a constraint requiring at least one cut edge. An edge is cut if and only if all of its required patch IDs are selected. A deterministic greedy heuristic acts as an automatic fallback.",
    },
    {
      q: "Why do standard offline mock scans return 'no_modeled_paths'?",
      a: "This is deliberate intellectual honesty. In offline mode without a local NVD database, the Skeptic cannot confirm CPE version applicability and AV:N vector support. Following the fail-closed rule, the Skeptic downgrades the findings, resulting in 0 modeled attack edges. Rather than fabricating a false attack graph, we report this honest reality.",
    },
    {
      q: "Does FutureForge deploy patches or execute live exploits?",
      a: "No. FutureForge is a planning, optimization, and verification engine. It models attack reachability, selects the minimal patch cut, and mathematically proves path elimination. It does not touch production deployment harnesses or execute exploitation payloads.",
    },
    {
      q: "How is independent verification distinct from optimizer output?",
      a: "Many tools claim a fix works simply because their solver returned a solution. FutureForge's verifier clones the graph into an isolated copy, applies the proposed patch set, and re-enumerates all simple paths from scratch. If any path to a crown jewel still exists, the status is stamped 'invalid'.",
    },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink font-sans selection:bg-copper selection:text-white relative">
      {/* Scroll progress hairline */}
      <div
        className="fixed top-0 left-0 h-0.5 bg-copper z-50 transition-all duration-75"
        style={{ width: `${scrollProgress * 100}%` }}
      />

      {/* Sticky Global Navigation */}
      <nav className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-line px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-ink text-paper flex items-center justify-center font-serif text-lg font-bold shadow-subtle">
            F
          </div>
          <div>
            <span className="font-serif font-bold text-lg text-ink tracking-tight">
              FutureForge
            </span>
            <span className="text-[10px] font-mono text-ink-3 block -mt-1">
              Evidence-Bounded Min-Cut Planner
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-mono">
          <a href="#hero-specimen" className="text-ink-2 hover:text-ink transition-colors">
            Overview
          </a>
          <a href="#pipeline" className="text-ink-2 hover:text-ink transition-colors">
            6-Stage Pipeline
          </a>
          <a href="#schematic" className="text-ink-2 hover:text-ink transition-colors">
            Min-Cut Simulator
          </a>
          <a href="#specimens" className="text-ink-2 hover:text-ink transition-colors">
            Evidence Specimen
          </a>
          <a href="#methodology" className="text-ink-2 hover:text-ink transition-colors">
            Methodology
          </a>
          <a href="#faq" className="text-ink-2 hover:text-ink transition-colors">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStartDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors border border-transparent hover:border-line"
            title="Launch 8-step interactive walkthrough"
          >
            <Sparkles className="w-3.5 h-3.5 text-copper" />
            <span className="hidden sm:inline">Guided Demo (G)</span>
          </button>
          <Link
            to="/console"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-bold rounded-lg bg-ink text-paper hover:bg-ink/90 active:scale-95 transition-all shadow-subtle"
          >
            <span>Open Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-line text-xs font-mono text-ink-2">
          <span className="w-2 h-2 rounded-full bg-copper animate-ping" />
          <span>CYBERSECURITY MIN-CUT OPTIMIZATION PLATFORM</span>
        </div>

        <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-ink leading-[1.08] max-w-4xl mx-auto">
          Don't patch everything. <br />
          <span className="italic text-copper">Cut the path.</span>
        </h1>

        <p className="font-mono text-sm md:text-base text-ink-2 max-w-2xl mx-auto leading-relaxed">
          FutureForge replaces unranked vulnerability backlogs with evidence-bounded attack graphs. Our Skeptic Agent disqualifies non-viable CVEs; our integer linear program solves the minimum-cost patch cut to protect your crown jewels.
        </p>

        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            to="/console"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-ink text-paper font-mono text-xs font-bold hover:bg-ink/90 active:scale-95 transition-all shadow-subtle"
          >
            <span>Enter Atelier Console</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={handleStartDemo}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-surface border border-line hover:border-line-strong font-mono text-xs text-ink-2 hover:text-ink transition-colors shadow-subtle"
          >
            <Sparkles className="w-4 h-4 text-copper" />
            <span>2-Minute Guided Tour (G)</span>
          </button>
        </div>

        {/* Live Metrics Ticker */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 text-left">
          <div className="p-4 rounded-xl border border-line bg-surface shadow-subtle space-y-1">
            <div className="font-mono text-[10px] uppercase text-ink-3">Modeled Path Reduction</div>
            <div className="font-serif text-3xl font-bold text-verified">100%</div>
            <div className="font-mono text-[10px] text-ink-3">In bounded modeled demo graph</div>
          </div>
          <div className="p-4 rounded-xl border border-line bg-surface shadow-subtle space-y-1">
            <div className="font-mono text-[10px] uppercase text-ink-3">Remediation Cost Savings</div>
            <div className="font-serif text-3xl font-bold text-copper">50.0%</div>
            <div className="font-mono text-[10px] text-ink-3">$25 optimal vs $50 exhaustive</div>
          </div>
          <div className="p-4 rounded-xl border border-line bg-surface shadow-subtle space-y-1">
            <div className="font-mono text-[10px] uppercase text-ink-3">Automated Test Suite</div>
            <div className="font-serif text-3xl font-bold text-ink">47 / 47</div>
            <div className="font-mono text-[10px] text-ink-3">Pytest engine & API passing</div>
          </div>
          <div className="p-4 rounded-xl border border-line bg-surface shadow-subtle space-y-1">
            <div className="font-mono text-[10px] uppercase text-ink-3">Motion Architecture</div>
            <div className="font-serif text-3xl font-bold text-ink">0 libs</div>
            <div className="font-mono text-[10px] text-ink-3">Pure CSS + WAAPI + Cytoscape</div>
          </div>
        </div>
      </section>

      {/* Hero Interactive Comparison Card */}
      <section id="hero-specimen" className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
          <div className="p-3 bg-surface-2 border-b border-line flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-ink flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-copper" />
              <span>THE OPERATIONAL SHIFT</span>
            </span>
            <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-line">
              <button
                onClick={() => setHeroView("conventional")}
                className={`px-3 py-1 rounded-md transition-all ${
                  heroView === "conventional"
                    ? "bg-ink text-paper font-bold"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                Conventional Triage
              </button>
              <button
                onClick={() => setHeroView("futureforge")}
                className={`px-3 py-1 rounded-md transition-all ${
                  heroView === "futureforge"
                    ? "bg-copper text-white font-bold"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                FutureForge Min-Cut
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {heroView === "conventional" ? (
              <div className="space-y-4 font-mono text-xs animate-fade-in">
                <div className="flex items-center justify-between text-threat font-bold">
                  <span>UNRANKED VULNERABILITY QUEUE (50+ ALERTS)</span>
                  <span className="stamp stamp-invalid">CVSS ORDERED ONLY</span>
                </div>
                <div className="space-y-2">
                  {[
                    { cve: "CVE-2023-45812", host: "backup02", cvss: "9.8 CRITICAL", status: "Isolated internal - no reachability" },
                    { cve: "CVE-2022-38411", host: "dev-test", cvss: "9.1 CRITICAL", status: "Dev container - no crown jewels" },
                    { cve: "CVE-2099-1001", host: "db01", cvss: "9.8 CRITICAL", status: "Active attack path to MariaDB crown jewel!" },
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-line bg-surface-2/40 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-ink">{row.cve}</span> ·{" "}
                        <span className="text-ink-2">{row.host}</span>
                        <div className="text-[11px] text-ink-3 mt-0.5">{row.status}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-threat/10 text-threat border border-threat/20 font-bold">
                        {row.cvss}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-ink-3 leading-relaxed pt-2">
                  Conventional scanners treat all criticals equally, causing engineering fatigue on isolated servers while leaving crown jewel paths exposed.
                </p>
              </div>
            ) : (
              <div className="space-y-4 font-mono text-xs animate-fade-in">
                <div className="flex items-center justify-between text-verified font-bold">
                  <span>VERIFIED ATTACK PATH BOTTLENECK REMEDIATION</span>
                  <span className="stamp stamp-verified">INDEPENDENTLY VERIFIED</span>
                </div>
                <div className="p-4 rounded-xl border border-verified/30 bg-verified/5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-bold text-ink text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-verified" />
                      <span>Single Optimal Patch: demo-db-fix</span>
                    </div>
                    <div className="text-[11px] text-ink-2">
                      Target: db01:3306 (MariaDB) · Modeled Attack Paths: 1 → 0
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-copper font-mono">$25 cost</span>
                    <div className="text-[10px] text-verified font-bold mt-0.5">100% PATHS CUT</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-ink-3 text-[11px]">
                  <span>Skeptic verified:</span>
                  <span className="text-ink font-semibold">db01 port 3306 reachable from app01</span> ·{" "}
                  <span className="text-ink font-semibold">AV:N confirmed</span> ·{" "}
                  <span className="text-ink font-semibold">Version 10.5.8 applicable</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6-Stage Assembly Line Pipeline Section */}
      <section id="pipeline" className="max-w-5xl mx-auto px-6 py-20 border-t border-line space-y-8">
        <div className="text-center space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-copper font-bold">
            § 01 · System Architecture
          </span>
          <h2 className="font-serif text-3xl font-bold text-ink">
            The 6-Stage Pipeline Assembly Line
          </h2>
          <p className="font-mono text-xs text-ink-3 max-w-xl mx-auto">
            From raw scanner telemetry to signed audit reports. Click any stage to inspect the underlying transformations and data contracts.
          </p>
        </div>

        {/* Pipeline Stepper Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {pipelineStages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setActivePipelineStep(stage.id)}
              className={`p-3 rounded-xl border text-left font-mono transition-all ${
                activePipelineStep === stage.id
                  ? "bg-surface border-copper ring-2 ring-copper/30 shadow-subtle"
                  : "bg-surface-2/40 border-line hover:border-line-strong text-ink-2"
              }`}
            >
              <div className="text-[10px] text-ink-3">{stage.owner}</div>
              <div className="font-bold text-xs text-ink mt-0.5 truncate">{stage.title}</div>
            </button>
          ))}
        </div>

        {/* Selected Stage Detail Card */}
        {pipelineStages[activePipelineStep] && (
          <div className="p-6 rounded-2xl border border-line bg-surface shadow-card space-y-4 font-mono text-xs animate-fade-in">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <span className="text-[10px] text-copper uppercase tracking-wider font-bold">
                  {pipelineStages[activePipelineStep].owner} RESPONSIBILITY
                </span>
                <h3 className="font-serif font-bold text-xl text-ink mt-1">
                  {pipelineStages[activePipelineStep].title}
                </h3>
                <p className="text-ink-2 text-xs mt-1">
                  {pipelineStages[activePipelineStep].tagline}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-surface-2/60 border border-line space-y-1">
                  <div className="text-[10px] text-ink-3 uppercase font-bold">Input Data Contract:</div>
                  <div className="text-ink font-semibold">{pipelineStages[activePipelineStep].input}</div>
                </div>

                <div className="p-3 rounded-xl bg-surface-2/60 border border-line space-y-1">
                  <div className="text-[10px] text-ink-3 uppercase font-bold">Emitted Artifact:</div>
                  <div className="text-copper font-semibold">{pipelineStages[activePipelineStep].output}</div>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="p-3 rounded-xl bg-stage-bg border border-white/10 text-white font-mono text-[11px] overflow-x-auto">
                <div className="text-[10px] text-stage-text-2 uppercase mb-2 flex items-center justify-between">
                  <span>Engine Implementation</span>
                  <span>Python 3.12</span>
                </div>
                <pre className="text-copper-stage leading-relaxed">
                  {pipelineStages[activePipelineStep].code}
                </pre>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Interactive Diamond Schematic Section */}
      <section id="schematic" className="max-w-4xl mx-auto px-6 py-20 border-t border-line space-y-8">
        <div className="text-center space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-copper font-bold">
            § 02 · Min-Cut Playground
          </span>
          <h2 className="font-serif text-3xl font-bold text-ink">
            Interactive Min-Cut Bottleneck Simulator
          </h2>
          <p className="font-mono text-xs text-ink-3 max-w-lg mx-auto">
            Two parallel attack vectors converge on one database crown jewel. Click patches below to observe mathematical path interruption and cost comparison in real time.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-stage-bg border border-white/10 shadow-stage max-w-3xl mx-auto text-center space-y-6">
          {/* HUD Summary Bar */}
          <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-stage-card border border-white/10 text-xs font-mono text-stage-text">
            <div>
              <div className="text-[10px] text-stage-text-2">ACTIVE ATTACK PATHS</div>
              <div className="text-2xl font-serif font-bold text-white tabular-nums">
                {activePathsCount} / 2
              </div>
            </div>
            <div>
              <div className="text-[10px] text-stage-text-2">TOTAL REMEDIATION COST</div>
              <div className="text-2xl font-serif font-bold text-copper-stage tabular-nums">
                ${totalCost}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-stage-text-2">VERIFICATION STATUS</div>
              <div className="mt-1">
                {activePathsCount === 0 ? (
                  hasP3 && totalCost === 1 ? (
                    <span className="text-verified-stage font-bold bg-verified-stage/20 px-2 py-0.5 rounded text-[11px]">
                      OPTIMAL MIN-CUT ($1)
                    </span>
                  ) : (
                    <span className="text-caution-stage font-bold bg-caution-stage/20 px-2 py-0.5 rounded text-[11px]">
                      EXHAUSTIVE CUT ($6)
                    </span>
                  )
                ) : (
                  <span className="text-threat font-bold bg-threat/20 px-2 py-0.5 rounded text-[11px]">
                    EXPLOITABLE ({activePathsCount} PATHS)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Topology Diagram */}
          <div className="relative py-8 flex items-center justify-between gap-6 px-4">
            {/* Entry Point Node S */}
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-16 h-16 rounded-2xl bg-stage-card border-2 border-copper-stage flex flex-col items-center justify-center text-white shadow-stage">
                <span className="font-bold text-sm">web01</span>
                <span className="text-[9px] text-copper-stage">ENTRY</span>
              </div>
              <span className="text-[10px] font-mono text-stage-text-2">Source (S)</span>
            </div>

            {/* Middle Branch Nodes (app01 and file01) */}
            <div className="flex flex-col gap-8 z-10">
              {/* Path A Node: app01 */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-28 p-2.5 rounded-xl border transition-all text-xs font-mono cursor-pointer ${
                    hasP1
                      ? "border-verified-stage bg-verified-stage/20 text-white"
                      : isPathAActive
                      ? "border-threat bg-threat/10 text-threat shadow-[0_0_12px_rgba(255,92,80,0.3)]"
                      : "border-white/10 bg-stage-card text-stage-text-2"
                  }`}
                  onClick={() => togglePatch("p1")}
                >
                  <div className="font-bold">app01</div>
                  <div className="text-[9px] text-stage-text-2">Patch P1 ($3)</div>
                  <div className="text-[8px] mt-0.5 font-bold">
                    {hasP1 ? "CUT APPLIED" : "CLICK TO CUT"}
                  </div>
                </div>
              </div>

              {/* Path B Node: file01 */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-28 p-2.5 rounded-xl border transition-all text-xs font-mono cursor-pointer ${
                    hasP2
                      ? "border-verified-stage bg-verified-stage/20 text-white"
                      : isPathBActive
                      ? "border-threat bg-threat/10 text-threat shadow-[0_0_12px_rgba(255,92,80,0.3)]"
                      : "border-white/10 bg-stage-card text-stage-text-2"
                  }`}
                  onClick={() => togglePatch("p2")}
                >
                  <div className="font-bold">file01</div>
                  <div className="text-[9px] text-stage-text-2">Patch P2 ($3)</div>
                  <div className="text-[8px] mt-0.5 font-bold">
                    {hasP2 ? "CUT APPLIED" : "CLICK TO CUT"}
                  </div>
                </div>
              </div>
            </div>

            {/* Crown Jewel Node T: db01 */}
            <div className="flex flex-col items-center gap-2 z-10">
              <div
                onClick={() => togglePatch("p3")}
                className={`w-32 p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center ${
                  hasP3
                    ? "border-verified-stage bg-verified-stage/20 text-verified-stage shadow-[0_0_24px_rgba(61,220,151,0.4)]"
                    : activePathsCount > 0
                    ? "border-threat bg-threat/10 text-white shadow-[0_0_16px_rgba(255,92,80,0.3)]"
                    : "border-crown bg-[#282415] text-crown"
                }`}
              >
                <div className="font-serif font-bold text-sm">db01</div>
                <div className="text-[9px] font-mono text-crown mt-0.5">CROWN JEWEL</div>
                <div className="text-[9px] font-mono mt-1 text-copper-stage font-bold">
                  Shared Patch P3 ($1)
                </div>
                <div className="text-[8px] font-mono mt-0.5 font-bold text-white/70">
                  {hasP3 ? "CUT (OPTIMAL)" : "CLICK MIN-CUT"}
                </div>
              </div>
              <span className="text-[10px] font-mono text-stage-text-2">Sink (T)</span>
            </div>
          </div>

          {/* Interactive Preset Buttons */}
          <div className="flex items-center justify-center gap-2 pt-2 text-xs font-mono flex-wrap">
            <button
              onClick={() => setActivePatches(new Set(["p3"]))}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                hasP3 && !hasP1 && !hasP2
                  ? "bg-verified-stage text-ink font-bold border-verified-stage shadow-subtle"
                  : "bg-white/10 hover:bg-white/20 text-stage-text border-white/10"
              }`}
            >
              Solve with Min-Cut Hitting Set (P3: $1)
            </button>
            <button
              onClick={() => setActivePatches(new Set(["p1", "p2"]))}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                hasP1 && hasP2 && !hasP3
                  ? "bg-caution-stage text-ink font-bold border-caution-stage shadow-subtle"
                  : "bg-white/10 hover:bg-white/20 text-stage-text border-white/10"
              }`}
            >
              Exhaustive Patching (P1 + P2: $6)
            </button>
            <button
              onClick={() => setActivePatches(new Set())}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stage-text-2 transition-colors border border-white/5 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </section>

      {/* Evidence Specimen Section */}
      <section id="specimens" className="max-w-4xl mx-auto px-6 py-20 border-t border-line space-y-8">
        <div className="text-center space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-copper font-bold">
            § 03 · Real Data Provenance
          </span>
          <h2 className="font-serif text-3xl font-bold text-ink">
            Inspecting the Evidence Artifacts
          </h2>
          <p className="font-mono text-xs text-ink-3 max-w-lg mx-auto">
            Everything presented in FutureForge is generated directly by real backend modules. Inspect the JSON artifacts passed across the pipeline.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
          <div className="p-3 bg-surface-2 border-b border-line flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-ink">
              {specimens[activeSpecimen].title}
            </span>
            <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-line">
              {(["finding", "verdict", "graph", "plan"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveSpecimen(key)}
                  className={`px-3 py-1 rounded-md uppercase text-[10px] font-bold transition-all ${
                    activeSpecimen === key
                      ? "bg-ink text-paper"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-stage-bg text-copper-stage font-mono text-xs overflow-x-auto">
            <pre className="leading-relaxed">
              {specimens[activeSpecimen].content}
            </pre>
          </div>
        </div>
      </section>

      {/* Methodology Section */}
      <section id="methodology" className="max-w-4xl mx-auto px-6 py-20 border-t border-line space-y-6">
        <div className="text-center space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-copper font-bold">
            § 04 · Mathematical Foundation
          </span>
          <h2 className="font-serif text-3xl font-bold text-ink">
            Mathematical Min-Cut Hitting Set
          </h2>
          <p className="font-mono text-xs text-ink-3 max-w-lg mx-auto">
            Formulating remediation as an integer linear program (ILP) rather than an unranked advisory list.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-line bg-surface space-y-4 font-mono text-xs">
          <p className="text-ink-2 leading-relaxed">
            {"Let P be the set of candidate patches, with each patch p in P having operational cost c_p > 0. Let Pi denote the set of all simple directed paths from any public entry point s in S to any designated crown jewel t in T in the evidence-bounded graph G = (V, E), capped at a maximum horizon of 8 hops."}
          </p>

          <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2 font-mono text-xs">
            <div className="font-bold text-ink">Optimization Objective:</div>
            <div className="text-copper font-bold">
              {"Minimize sum(c_p * x_p for p in P)  where x_p in {0, 1}"}
            </div>
            <div className="text-ink-2 pt-2">
              Subject to the path interruption constraint:
            </div>
            <div className="text-copper font-bold">
              {"for every path pi in Pi: sum(1_{patches(e) subset P_selected} for e in pi) >= 1"}
            </div>
          </div>

          <p className="text-ink-3 text-[11px] leading-relaxed">
            Solved deterministically via the CBC branch-and-cut solver in PuLP. Independent verification subsequently builds a fresh graph copy, removes edges meeting the full patch coverage requirement, and asserts that zero simple paths remain.
          </p>
        </div>
      </section>

      {/* Interactive FAQ Section */}
      <section id="faq" className="max-w-4xl mx-auto px-6 py-20 border-t border-line space-y-8">
        <div className="text-center space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-copper font-bold">
            § 05 · Common Inquiries
          </span>
          <h2 className="font-serif text-3xl font-bold text-ink">
            Frequently Asked Questions
          </h2>
          <p className="font-mono text-xs text-ink-3 max-w-lg mx-auto">
            Technical answers to architectural and operational questions.
          </p>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-line bg-surface overflow-hidden shadow-subtle transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left font-bold text-ink flex items-center justify-between gap-4 hover:bg-surface-2/40 transition-colors"
                >
                  <span className="text-sm font-serif">{faq.q}</span>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-copper flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-3 flex-shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="p-4 pt-0 border-t border-line/40 text-ink-2 leading-relaxed text-xs bg-surface-2/20">
                    <p className="pt-2">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Model Boundaries Section */}
      <section id="boundaries" className="max-w-4xl mx-auto px-6 py-20 border-t border-line space-y-6">
        <div className="text-center space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-copper font-bold">
            § 06 · Intellectual Honesty
          </span>
          <h2 className="font-serif text-3xl font-bold text-ink">
            Honest Boundaries & Limitations
          </h2>
          <p className="font-mono text-xs text-ink-3 max-w-lg mx-auto">
            We never claim a system is "100% secure" or "zero risk". Here are the exact mathematical constraints of our engine.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl border border-line bg-surface space-y-1">
            <div className="font-serif font-bold text-ink text-sm">Evidence-Bounded Model</div>
            <p className="text-ink-2 leading-relaxed text-[11px]">
              The graph models only relationships supported by scan and reach data. Missing evidence produces missing attack edges (fail-closed rule).
            </p>
          </div>
          <div className="p-4 rounded-xl border border-line bg-surface space-y-1">
            <div className="font-serif font-bold text-ink text-sm">No Exploits Executed</div>
            <p className="text-ink-2 leading-relaxed text-[11px]">
              Vulnerability applicability is evaluated via deterministic rules (CPE matching, version comparison, network vector), never by running live payloads.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-line bg-surface space-y-1">
            <div className="font-serif font-bold text-ink text-sm">Bounded Hop Cap</div>
            <p className="text-ink-2 leading-relaxed text-[11px]">
              Path enumeration is capped at 8 hops. Verification guarantees that zero paths exist within this bounded mathematical graph.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-line bg-surface space-y-1">
            <div className="font-serif font-bold text-ink text-sm">Synthetic Data Discipline</div>
            <p className="text-ink-2 leading-relaxed text-[11px]">
              Demonstration runs using CVE-2099-* identifiers are always stamped SYNTHETIC DATA and never represented as real security findings.
            </p>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="bg-surface border-t border-line py-16 text-center space-y-4">
        <h3 className="font-serif text-3xl font-bold text-ink">
          Operate the Engine
        </h3>
        <p className="text-xs font-mono text-ink-3 max-w-md mx-auto">
          Experience the real Python optimizer, Skeptic rules, and independent verifier running in real time.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/console"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-ink text-paper font-mono text-xs font-bold hover:bg-ink/90 active:scale-95 transition-all shadow-subtle"
          >
            <span>Launch FutureForge Console</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/console/report"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-surface border border-line hover:border-line-strong font-mono text-xs text-ink-2 hover:text-ink transition-colors shadow-subtle"
          >
            <FileText className="w-4 h-4" />
            <span>View Ledger Report</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-8 bg-surface-2/40 text-xs font-mono text-ink-3">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-serif font-bold text-ink text-sm">FutureForge</div>
            <div className="text-[11px]">Don't patch everything. Cut the path.</div>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/console" className="hover:text-ink transition-colors">
              Console
            </Link>
            <Link to="/console/report" className="hover:text-ink transition-colors">
              Report
            </Link>
            <a
              href="https://github.com/Gitika-27/DataOps-FurtureForge"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="text-center text-[10px] text-ink-3/60 mt-4">
          Evidence-bounded model · No exploits executed · Hackathon Persona 4 Delivery
        </div>
      </footer>
    </div>
  );
};
