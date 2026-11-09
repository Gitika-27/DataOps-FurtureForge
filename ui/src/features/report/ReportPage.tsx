import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Printer,
  Download,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileCode,
  FileText,
  Lock,
} from "lucide-react";
import { useConsoleStore } from "../console/useConsoleStore";

export const ReportPage: React.FC = () => {
  const { bundle } = useConsoleStore();
  const [showRawIframe, setShowRawIframe] = useState(false);

  const runId = bundle?.run_id || "latest";
  const plan = bundle?.plan?.plan;
  const verification = bundle?.plan?.verification;
  const verdicts = bundle?.verdicts || [];
  const rawFindings = bundle?.raw_findings || [];
  const assets = bundle?.assets || [];
  const cutEdges = bundle?.derived?.cut_edges || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans pb-16 selection:bg-copper selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-line px-6 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            to="/console"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-2 hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors border border-line"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Console</span>
          </Link>
          <div className="h-4 w-px bg-line" />
          <span className="font-serif font-bold text-base text-ink">
            Verification & Evidence Ledger
          </span>
        </div>

        <div className="flex items-center gap-2">
          {bundle?.artifacts?.report_html && (
            <button
              onClick={() => setShowRawIframe(!showRawIframe)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-mono text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-copper" />
              <span>{showRawIframe ? "Structured Document" : "Sandboxed Raw HTML"}</span>
            </button>
          )}

          {bundle?.artifacts?.report_pdf && (
            <a
              href={`/api/runs/${runId}/report?format=pdf`}
              download={`futureforge_report_${runId}.pdf`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-mono text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
          )}

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-ink text-paper text-xs font-mono font-bold hover:bg-ink/90 transition-colors shadow-subtle"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Ledger</span>
          </button>
        </div>
      </header>

      {/* Main Report Document Container */}
      <main className="max-w-4xl mx-auto mt-8 px-6">
        {showRawIframe && bundle?.artifacts?.report_html ? (
          <div className="bg-surface rounded-2xl border border-line shadow-card overflow-hidden">
            <div className="p-3 bg-surface-2 border-b border-line text-xs font-mono text-ink-3 flex items-center justify-between">
              <span>SANDBOXED BACKEND ARTIFACT EMBED</span>
              <span>CSP: default-src 'self'</span>
            </div>
            <iframe
              src={`/api/runs/${runId}/report?format=html`}
              sandbox="allow-same-origin"
              title="Raw Backend HTML Report"
              className="w-full h-[85vh] border-0"
            />
          </div>
        ) : (
          <article className="bg-surface rounded-2xl border border-line p-10 shadow-card space-y-8 print:shadow-none print:border-none print:p-0">
            {/* Header Stamp & Metadata */}
            <div className="flex items-start justify-between border-b border-line pb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] tracking-widest text-copper uppercase font-bold">
                    OFFICIAL ENGINE LEDGER
                  </span>
                  {bundle?.synthetic && (
                    <span className="text-[10px] font-mono tracking-wider font-semibold text-copper bg-copper/10 px-2 py-0.5 rounded border border-copper/20">
                      SYNTHETIC DEMO DATA
                    </span>
                  )}
                </div>
                <h1 className="font-serif text-3xl font-bold text-ink">
                  FutureForge Verification Report
                </h1>
                <p className="text-xs font-mono text-ink-3 mt-1">
                  Run ID: {runId} · Generated: {bundle?.created_at ? new Date(bundle.created_at).toUTCString() : "Pending"}
                </p>
              </div>

              <div className="text-right">
                {bundle?.status === "verified" && (
                  <span className="stamp stamp-verified">VERIFIED</span>
                )}
                {bundle?.status === "no_modeled_paths" && (
                  <span className="stamp stamp-no-paths">NO MODELED PATHS</span>
                )}
                {bundle?.status === "invalid" && (
                  <span className="stamp stamp-invalid">INVALID</span>
                )}
              </div>
            </div>

            {/* Executive Summary (Engine Sentences) */}
            <section className="space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-widest text-ink-3 font-semibold">
                § 01 · Executive Summary
              </h2>
              <div className="p-4 rounded-xl border border-line bg-surface-2/40 text-xs font-mono leading-relaxed space-y-2 text-ink-2">
                <p>
                  <strong className="text-ink">1. Attack-Path Analysis: </strong>
                  The analyzer modeled {bundle?.plan?.plan?.paths_before ?? 0} attack paths from entry points to designated crown jewels based on verified remotely exploitable findings and network topology reachability.
                </p>
                <p>
                  <strong className="text-ink">2. Optimization Result: </strong>
                  The binary min-cut program selected {plan?.patches?.length ?? 0} remediation actions targeting critical path bottlenecks at minimal aggregate cost.
                </p>
                <p>
                  <strong className="text-ink">3. Independent Verification: </strong>
                  {bundle?.status === "verified"
                    ? "Independent verification confirms zero attack paths remain in the bounded modeled graph following simulated patch application."
                    : "No supported paths were modeled, or verification did not confirm complete cut of modeled paths."}
                </p>
              </div>
            </section>

            {/* Proposed Remediation Plan Table */}
            <section className="space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-widest text-ink-3 font-semibold">
                § 02 · Selected Remediation Plan
              </h2>
              <table className="w-full text-xs font-mono border-collapse border border-line">
                <thead>
                  <tr className="bg-surface-2 text-ink text-left">
                    <th className="p-2.5 border border-line">Patch ID</th>
                    <th className="p-2.5 border border-line">Target Asset & Port</th>
                    <th className="p-2.5 border border-line">Associated CVE</th>
                    <th className="p-2.5 border border-line text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {plan?.patches && plan.patches.length > 0 ? (
                    plan.patches.map((pid) => {
                      const related = bundle?.reviewed_findings?.find((f) => f.patch_id === pid);
                      return (
                        <tr key={pid} className="hover:bg-surface-2/30">
                          <td className="p-2.5 border border-line font-bold text-copper">{pid}</td>
                          <td className="p-2.5 border border-line">{related ? `${related.asset_id}:${related.port}` : "Multi-target"}</td>
                          <td className="p-2.5 border border-line">{related?.cve || "N/A"}</td>
                          <td className="p-2.5 border border-line text-right">{related?.patch_cost ?? 1}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-ink-3 italic border border-line">
                        No remediation actions required.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            {/* Skeptic Verdicts Ledger */}
            <section className="space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-widest text-ink-3 font-semibold">
                § 03 · Skeptic Verdict Ledger ({verdicts.length})
              </h2>
              <div className="space-y-2">
                {verdicts.map((v) => {
                  const raw = rawFindings.find((f) => f.id === v.finding_id);
                  return (
                    <div key={v.finding_id} className="p-3.5 rounded-xl border border-line text-xs font-mono space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{raw?.cve || v.finding_id}</span>
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                            v.status === "confirmed"
                              ? "bg-threat text-white"
                              : v.status === "downgraded"
                              ? "bg-caution/20 text-caution"
                              : "bg-line text-ink-3 line-through"
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-2 leading-relaxed">
                        {v.reasoning}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Limitations & Boundary Notice */}
            <section className="pt-6 border-t border-line text-[11px] font-mono text-ink-3 leading-relaxed space-y-1">
              <div className="font-bold text-ink uppercase tracking-wider text-[10px]">
                Model Boundary Notice
              </div>
              <p>
                This report represents mathematical relationships bounded to scanner findings and topology reachability records. Zero remaining modeled paths does not constitute proof of total organizational security. No exploits were executed.
              </p>
            </section>
          </article>
        )}
      </main>
    </div>
  );
};
