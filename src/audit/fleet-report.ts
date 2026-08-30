/**
 * Fleet report — what the operators have been telling us.
 *
 * Every repo's ledger records decisions with reasons, but each ledger is
 * only ever read by its own repo. Field round 2 made the cost concrete:
 * four repos independently hit the same detector defects, three of them
 * declined to file `noise` because it would ratchet their lane floor,
 * and the signal only surfaced a week later by hand-reading pull
 * requests. This scans sibling checkouts and ranks what the fleet is
 * actually reporting, so a recurring mechanical defect is one command
 * away instead of an archaeology project.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readDataBranchLedger } from "./data-branch.js";
import {
  laneOf,
  LEDGER_PATH,
  readLedger,
  type HumanVerdict,
  type VerdictEvent,
} from "./ledger.js";

export interface FleetClaim {
  repo: string;
  fingerprint: string;
  lane: string;
  verdict: HumanVerdict;
  mechanism: string;
  reason: string;
  at: string;
}

export interface FleetReport {
  repos: { repo: string; verdicts: Record<string, number> }[];
  /** Detector-gap + noise claims: the false-positive record. */
  claims: FleetClaim[];
  /** mechanism → repos affected (deduped), worst first. */
  byMechanism: { mechanism: string; repos: string[]; claims: number }[];
  /** lane → repos affected, worst first. */
  byLane: { lane: string; repos: string[]; claims: number }[];
}

/** Checkouts under `dir` that carry a vibeCompact ledger. */
export function findLedgerRepos(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    const candidate = join(dir, entry);
    try {
      if (!statSync(candidate).isDirectory()) continue;
    } catch {
      continue;
    }
    if (existsSync(join(candidate, LEDGER_PATH))) found.push(candidate);
  }
  return found.sort();
}

/**
 * A verdict is evidence about the DETECTOR when it is an explicit
 * detector-gap claim, or a `noise` verdict — noise means "this finding
 * is wrong", which is the same information filed through the older,
 * ratcheting channel.
 */
function isDetectorEvidence(event: VerdictEvent): boolean {
  return event.verdict === "detector-gap" || event.verdict === "noise";
}

/**
 * A verdict that retracts the operator's OWN earlier decision, not a
 * claim about the detector. watchparty filed two of these ("Superseded:
 * … written without opening the file"); counting them as detector
 * defects would overstate our false-positive rate in exactly the
 * direction this report exists to correct.
 */
export const OPERATOR_RETRACTION = "operator-retraction";

/** Best-effort mechanism when a pre-`detector-gap` verdict has none. */
export function inferMechanism(reason: string): string {
  const text = reason.toLowerCase();
  // Retraction first: these often quote the original (wrong) reasoning,
  // which would otherwise match a mechanism rule below.
  if (
    /superseded|corrects the (noise|verdict)|i had not read|written without (opening|reading)|that was wrong and i/.test(
      text,
    )
  ) {
    return OPERATOR_RETRACTION;
  }
  const rules: [RegExp, string][] = [
    [/decorator|@routes|@app\.|flask|aiohttp|click|pytest fixture/, "decorator-registration"],
    [/\.astro|\.vue|\.svelte|client:only|island|mounts? </, "template-mount"],
    [/config|eslint|vite\.config|has no achievable form|cannot have a test|not importable by a test/, "unreachable-by-design"],
    [/dist|exports map|published|package entry|re-export|nodenext|\.js specifier/, "published-surface"],
    [/convention|hook|plugin|loaded by directory|entry script|pm2|systemd|cron|execstart/, "convention-loading"],
    [/playwright|cross-language|real chromium|browser-driven|selenium|cypress/, "cross-language-coverage"],
    [/symbol map|span|inflat|counts comments|not stripping comments|percentage|mis-report|measure/, "measurement"],
    [/import graph|fan-in|resolver|cannot see|does not traverse|blind/, "module-resolution"],
  ];
  for (const [re, mechanism] of rules) if (re.test(text)) return mechanism;
  return "other";
}

export function buildFleetReport(repoPaths: string[]): FleetReport {
  const repos: FleetReport["repos"] = [];
  const claims: FleetClaim[] = [];

  for (const repoPath of repoPaths) {
    const name = repoPath.split("/").filter(Boolean).pop() ?? repoPath;
    const counts: Record<string, number> = {};
    // Latest verdict per fingerprint, so a superseded decision is not
    // double-counted as evidence.
    const latest = new Map<string, VerdictEvent>();
    // Same union the audit itself reads: verdicts land on the default
    // branch, machine events often only ever exist on the data branch.
    const events = [
      ...readLedger(repoPath),
      ...readDataBranchLedger(repoPath),
    ];
    for (const event of events) {
      if (!("verdict" in event)) continue;
      if (event.verdict === "fixed") continue;
      const prior = latest.get(event.fingerprint);
      if (!prior || event.at > prior.at) latest.set(event.fingerprint, event);
    }
    for (const event of latest.values()) {
      counts[event.verdict] = (counts[event.verdict] ?? 0) + 1;
      if (!isDetectorEvidence(event)) continue;
      claims.push({
        repo: name,
        fingerprint: event.fingerprint,
        lane: laneOf(event.fingerprint),
        verdict: event.verdict,
        mechanism: event.mechanism ?? inferMechanism(event.reason),
        reason: event.reason,
        at: event.at,
      });
    }
    repos.push({ repo: name, verdicts: counts });
  }

  const defects = claims.filter((c) => c.mechanism !== OPERATOR_RETRACTION);
  const group = (key: (c: FleetClaim) => string) => {
    const acc = new Map<string, Set<string>>();
    const count = new Map<string, number>();
    for (const claim of defects) {
      const k = key(claim);
      const set = acc.get(k) ?? new Set<string>();
      set.add(claim.repo);
      acc.set(k, set);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    return [...acc.entries()]
      .map(([k, set]) => ({
        key: k,
        repos: [...set].sort(),
        claims: count.get(k) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.repos.length - a.repos.length ||
          b.claims - a.claims ||
          (a.key < b.key ? -1 : 1),
      );
  };

  return {
    repos,
    claims: claims.sort((a, b) => (a.at < b.at ? 1 : -1)),
    byMechanism: group((c) => c.mechanism).map((g) => ({
      mechanism: g.key,
      repos: g.repos,
      claims: g.claims,
    })),
    byLane: group((c) => c.lane).map((g) => ({
      lane: g.key,
      repos: g.repos,
      claims: g.claims,
    })),
  };
}

export function renderFleetReport(report: FleetReport): string {
  const lines: string[] = ["# vibeCompact — fleet report", ""];
  const retractions = report.claims.filter(
    (c) => c.mechanism === OPERATOR_RETRACTION,
  );
  const defectCount = report.claims.length - retractions.length;
  lines.push(
    `Ledgers read: ${report.repos.length} (working tree + data branch). ` +
      `Detector claims: ${defectCount}` +
      (retractions.length > 0
        ? `; operator retractions excluded from the ranking: ${retractions.length}.`
        : "."),
    "",
  );

  if (report.claims.length === 0) {
    lines.push("No detector-gap or noise verdicts on record.", "");
  } else {
    lines.push(
      "## Detector defects by mechanism (repos affected first)",
      "",
      "| mechanism | repos | claims | where |",
      "|---|---|---|---|",
    );
    for (const row of report.byMechanism) {
      lines.push(
        `| ${row.mechanism} | **${row.repos.length}** | ${row.claims} | ${row.repos.join(", ")} |`,
      );
    }
    lines.push("", "## By lane", "", "| lane | repos | claims |", "|---|---|---|");
    for (const row of report.byLane) {
      lines.push(`| ${row.lane} | ${row.repos.length} | ${row.claims} |`);
    }
    lines.push("", "## Claims", "");
    for (const claim of report.claims) {
      lines.push(
        `- **${claim.repo}** \`${claim.fingerprint}\` · ${claim.verdict} · _${claim.mechanism}_ — ${claim.reason.split("\n")[0].slice(0, 200)}`,
      );
    }
  }

  lines.push("", "## Verdict volume per repo", "", "| repo | verdicts |", "|---|---|");
  for (const repo of report.repos) {
    const detail =
      Object.entries(repo.verdicts)
        .sort()
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") || "none";
    lines.push(`| ${repo.repo} | ${detail} |`);
  }
  return lines.join("\n") + "\n";
}

/** CLI: scan sibling checkouts (default: the parent of `rootPath`). */
export function runFleetReport(rootPath: string, scanDir?: string): string {
  const dir = resolve(scanDir ?? dirname(resolve(rootPath)));
  const repos = findLedgerRepos(dir);
  return renderFleetReport(buildFleetReport(repos));
}
