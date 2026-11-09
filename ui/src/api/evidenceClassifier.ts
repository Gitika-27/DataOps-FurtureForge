export type EvidenceCategory = "positive" | "warning" | "neutral";

const POSITIVE_PREFIXES = [
  "scanner reports",
  "nmap observed",
  "topology records",
  "nvd vulnerable cpe",
  "nvd cvss vector identifies",
];

const WARNING_PATTERNS = [
  "no ",
  "unavailable",
  "does not",
  "ambiguous",
  "missing",
  "not treated",
];

/**
 * Classifies an individual Skeptic evidence ledger line according to engine rules.
 */
export function classifyEvidenceLine(line: string): EvidenceCategory {
  if (!line || typeof line !== "string") return "neutral";
  const lower = line.trim().toLowerCase();

  for (const prefix of POSITIVE_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return "positive";
    }
  }

  for (const pattern of WARNING_PATTERNS) {
    if (lower.includes(pattern)) {
      return "warning";
    }
  }

  return "neutral";
}
