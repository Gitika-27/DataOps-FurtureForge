import { describe, it, expect } from "vitest";
import { classifyEvidenceLine } from "./evidenceClassifier";

describe("classifyEvidenceLine", () => {
  it("classifies verified positive evidence correctly", () => {
    expect(classifyEvidenceLine("Scanner reports Apache 2.4.54")).toBe("positive");
    expect(classifyEvidenceLine("Nmap observed port 80 open")).toBe("positive");
    expect(classifyEvidenceLine("Topology records path from internet")).toBe("positive");
    expect(classifyEvidenceLine("NVD vulnerable CPE matches version 2.4.54")).toBe("positive");
    expect(classifyEvidenceLine("NVD CVSS vector identifies NETWORK attack")).toBe("positive");
  });

  it("classifies warnings and fail-closed evidence lines", () => {
    expect(classifyEvidenceLine("No matching service version found")).toBe("warning");
    expect(classifyEvidenceLine("NVD enrichment is unavailable offline")).toBe("warning");
    expect(classifyEvidenceLine("Version does not match fixed target")).toBe("warning");
    expect(classifyEvidenceLine("Ambiguous suggested port cannot confirm exploitability")).toBe("warning");
    expect(classifyEvidenceLine("Missing AV:N metric")).toBe("warning");
    expect(classifyEvidenceLine("Port 0 not treated as proof")).toBe("warning");
  });

  it("returns neutral for non-matching or generic lines", () => {
    expect(classifyEvidenceLine("Review completed by deterministic rules.")).toBe("neutral");
    expect(classifyEvidenceLine("")).toBe("neutral");
  });
});
