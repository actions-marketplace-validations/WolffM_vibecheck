/**
 * Rust Tool Parsers
 *
 * Parsers for Rust analysis tools:
 * - Clippy (linter)
 * - cargo-audit (security)
 * - cargo-deny (dependency linter)
 */

import {
  buildLocation,
  createFinding,
  parseResults,
} from "../utils/parser-utils.js";
import {
  mapClippySeverity,
  mapClippyConfidence,
  mapCargoAuditSeverity,
  mapCargoAuditConfidence,
  mapCargoDenySeverity,
  mapCargoDenyConfidence,
} from "../scoring/index.js";
import type { Finding } from "../core/types.js";

// ============================================================================
// Clippy Parser (Rust Linter)
// ============================================================================

interface ClippySpan {
  file_name: string;
  line_start: number;
  line_end: number;
  column_start: number;
  column_end: number;
  is_primary: boolean;
  label?: string;
  suggested_replacement?: string;
  suggestion_applicability?: string;
}

interface ClippyMessage {
  message: string;
  code?: {
    code: string;
    explanation?: string;
  };
  level: string;
  spans: ClippySpan[];
  children?: ClippyMessage[];
  rendered?: string;
}

/**
 * Parse Clippy JSON output into Findings.
 */
export function parseClippyOutput(messages: unknown[]): Finding[] {
  return parseResults(messages, (msg) => {
    const message = msg as ClippyMessage;

    // Skip notes and help messages without codes
    if (
      (message.level === "note" || message.level === "help") &&
      !message.code
    ) {
      return null;
    }

    // Skip messages without spans (file locations)
    if (!message.spans || message.spans.length === 0) {
      return null;
    }

    // Find the primary span
    const primarySpan =
      message.spans.find((s) => s.is_primary) || message.spans[0];
    if (!primarySpan) {
      return null;
    }

    const lintCode = message.code?.code || "unknown";
    const hasSuggestion = message.children?.some(
      (c) => c.spans?.some((s) => s.suggested_replacement !== undefined),
    );

    return createFinding({
      result: message,
      tool: "clippy",
      ruleId: lintCode,
      title: `Clippy: ${lintCode}`,
      message: message.message,
      severity: mapClippySeverity(message.level, lintCode),
      confidence: mapClippyConfidence(lintCode),
      location: buildLocation(
        primarySpan.file_name,
        primarySpan.line_start,
        primarySpan.column_start,
        primarySpan.line_end,
        primarySpan.column_end,
      ),
      hasAutofix: hasSuggestion,
      evidence: message.rendered
        ? { snippet: message.rendered }
        : undefined,
    });
  });
}

// ============================================================================
// cargo-audit Parser (Security Scanner)
// ============================================================================

interface CargoAuditVulnerability {
  advisory: {
    id: string;
    package: string;
    title: string;
    description: string;
    date: string;
    severity?: string;
    url?: string;
    categories: string[];
    keywords: string[];
    cvss?: string;
  };
  versions: {
    patched: string[];
    unaffected: string[];
  };
  package: {
    name: string;
    version: string;
    source?: string;
  };
}

export interface CargoAuditOutput {
  database: {
    advisory_count: number;
    last_commit: string;
    last_updated: string;
  };
  lockfile: {
    dependency_count: number;
    path: string;
  };
  vulnerabilities: {
    count: number;
    list: CargoAuditVulnerability[];
  };
  warnings?: {
    unmaintained?: Array<{
      advisory: {
        id: string;
        package: string;
        title: string;
        description: string;
        url?: string;
      };
      package: {
        name: string;
        version: string;
      };
    }>;
    yanked?: Array<{
      package: {
        name: string;
        version: string;
      };
    }>;
  };
}

/**
 * Parse cargo-audit JSON output into Findings.
 */
export function parseCargoAuditOutput(output: CargoAuditOutput): Finding[] {
  const findings: Finding[] = [];

  // Process vulnerabilities
  if (output.vulnerabilities?.list) {
    for (const vuln of output.vulnerabilities.list) {
      const cvssScore = vuln.advisory.cvss
        ? parseFloat(vuln.advisory.cvss)
        : undefined;

      findings.push(
        createFinding({
          result: vuln,
          tool: "cargo-audit",
          ruleId: vuln.advisory.id,
          title: `Security Advisory: ${vuln.advisory.id}`,
          message: `${vuln.advisory.title}\n\nPackage: ${vuln.package.name}@${vuln.package.version}\n\n${vuln.advisory.description}`,
          severity: mapCargoAuditSeverity(
            vuln.advisory.severity || "unknown",
            cvssScore,
          ),
          confidence: mapCargoAuditConfidence(),
          location: buildLocation(output.lockfile.path || "Cargo.lock", 1),
          layer: "security",
          evidence: {
            links: vuln.advisory.url ? [vuln.advisory.url] : [],
          },
          extraLabels: [
            `package:${vuln.package.name}`,
            ...vuln.advisory.categories.map((c) => `category:${c}`),
          ],
        }),
      );
    }
  }

  // Process unmaintained warnings
  if (output.warnings?.unmaintained) {
    for (const warn of output.warnings.unmaintained) {
      findings.push(
        createFinding({
          result: warn,
          tool: "cargo-audit",
          ruleId: warn.advisory.id,
          title: `Unmaintained: ${warn.advisory.id}`,
          message: `${warn.advisory.title}\n\nPackage: ${warn.package.name}@${warn.package.version}\n\n${warn.advisory.description}`,
          severity: "medium",
          confidence: mapCargoAuditConfidence(),
          location: buildLocation(output.lockfile.path || "Cargo.lock", 1),
          layer: "security",
          evidence: {
            links: warn.advisory.url ? [warn.advisory.url] : [],
          },
          extraLabels: [`package:${warn.package.name}`, "unmaintained"],
        }),
      );
    }
  }

  // Process yanked warnings
  if (output.warnings?.yanked) {
    for (const warn of output.warnings.yanked) {
      findings.push(
        createFinding({
          result: warn,
          tool: "cargo-audit",
          ruleId: "yanked",
          title: "Yanked Crate",
          message: `Package ${warn.package.name}@${warn.package.version} has been yanked from crates.io`,
          severity: "medium",
          confidence: mapCargoAuditConfidence(),
          location: buildLocation(output.lockfile.path || "Cargo.lock", 1),
          layer: "security",
          extraLabels: [`package:${warn.package.name}`, "yanked"],
        }),
      );
    }
  }

  return findings;
}

// ============================================================================
// cargo-deny Parser (Dependency Linter)
// ============================================================================

interface CargoDenyDiagnostic {
  type: string; // "error", "warning", "note"
  fields: {
    message: string;
    code?: string;
    labels?: Array<{
      span?: {
        file?: string;
        start?: { line: number; column: number };
        end?: { line: number; column: number };
      };
      message?: string;
    }>;
    severity?: string;
    // Advisory-specific fields
    advisory?: {
      id: string;
      title: string;
      description?: string;
      severity?: string;
      url?: string;
    };
    // License-specific fields
    license?: string;
    // Crate info
    crate_name?: string;
    crate_version?: string;
  };
  // Category of check
  category?: string;
}

export interface CargoDenyOutput {
  diagnostics: unknown[];
}

/**
 * Parse cargo-deny JSON output into Findings.
 */
export function parseCargoDenyOutput(output: CargoDenyOutput): Finding[] {
  return parseResults(output.diagnostics, (diag) => {
    const diagnostic = diag as CargoDenyDiagnostic;

    // Skip notes that are just informational
    if (diagnostic.type === "note" && !diagnostic.fields.code) {
      return null;
    }

    const fields = diagnostic.fields;
    const category =
      diagnostic.category ||
      (fields.advisory ? "advisories" : fields.license ? "licenses" : "bans");

    // Build rule ID
    let ruleId = fields.code || category;
    if (fields.advisory?.id) {
      ruleId = fields.advisory.id;
    }

    // Build title
    let title = `cargo-deny: ${ruleId}`;
    if (fields.advisory?.title) {
      title = `Advisory: ${fields.advisory.title}`;
    } else if (fields.license) {
      title = `License: ${fields.license}`;
    }

    // Build message
    let message = fields.message;
    if (fields.crate_name && fields.crate_version) {
      message = `${message}\n\nCrate: ${fields.crate_name}@${fields.crate_version}`;
    }
    if (fields.advisory?.description) {
      message = `${message}\n\n${fields.advisory.description}`;
    }

    // Find location from labels
    let filePath = "Cargo.toml";
    let startLine = 1;
    let startCol: number | undefined;
    let endLine: number | undefined;
    let endCol: number | undefined;

    if (fields.labels && fields.labels.length > 0) {
      const label = fields.labels[0];
      if (label.span?.file) {
        filePath = label.span.file;
        startLine = label.span.start?.line || 1;
        startCol = label.span.start?.column;
        endLine = label.span.end?.line;
        endCol = label.span.end?.column;
      }
    }

    return createFinding({
      result: diagnostic,
      tool: "cargo-deny",
      ruleId,
      title,
      message,
      severity: mapCargoDenySeverity(
        category,
        fields.advisory?.severity || fields.severity,
      ),
      confidence: mapCargoDenyConfidence(category),
      location: buildLocation(filePath, startLine, startCol, endLine, endCol),
      layer: category === "advisories" ? "security" : "architecture",
      evidence: fields.advisory?.url
        ? { links: [fields.advisory.url] }
        : undefined,
      extraLabels: [
        `category:${category}`,
        ...(fields.crate_name ? [`package:${fields.crate_name}`] : []),
      ],
    });
  });
}
