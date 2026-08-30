/**
 * vulture runner (dead-code lane substrate, Python)
 *
 * Single-source Python dead-code detection. The design's confidence rule
 * (Vulture ∪ Skylos, both-flagged = medium) applies its demotion in the
 * lane — this runner just reports what vulture saw at ≥60% confidence.
 */

import { spawnSync } from "node:child_process";
import { describeRunFailure } from "./run-failure.js";

export interface VultureItem {
  path: string;
  line: number;
  confidence: number;
  /** e.g. "unused function 'render_pose'". */
  description: string;
}

export interface VultureResult {
  available: boolean;
  items: VultureItem[];
}

const LINE_PATTERN = /^(.+?):(\d+): (unused .+?) \((\d+)% confidence/;

export function runVulture(rootPath: string): VultureResult {
  // A bare `vulture` depends on pip's bin dir being on PATH — runner
  // environments routinely miss that while the module is importable, so
  // fall back to `python3 -m vulture`.
  let command = ["vulture"];
  const probe = spawnSync("vulture", ["--version"], {
    encoding: "utf-8",
    stdio: "pipe",
  });
  if (probe.error || probe.status !== 0) {
    const moduleProbe = spawnSync("python3", ["-m", "vulture", "--version"], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    if (moduleProbe.error || moduleProbe.status !== 0) {
      console.warn("vulture unavailable: neither on PATH nor importable by python3");
      return { available: false, items: [] };
    }
    command = ["python3", "-m", "vulture"];
  }

  const run = spawnSync(
    command[0],
    [
      ...command.slice(1),
      ".",
      "--min-confidence",
      "60",
      "--exclude",
      "node_modules,vendor,build,dist,.venv,venv,__pycache__,migrations",
    ],
    {
      cwd: rootPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
    },
  );
  // vulture exits 3 when it finds dead code — that is success with data.
  // `run.error` alone only catches a failure to SPAWN; vulture exiting non-zero
  // for a reason other than "found dead code" (exit 3) fell straight through
  // into the parse loop and reported zero items.
  if (run.error || (run.status !== 0 && run.status !== 3)) {
    console.warn(`vulture failed: ${describeRunFailure(run)}`);
    return { available: false, items: [] };
  }

  const items: VultureItem[] = [];
  for (const line of (run.stdout ?? "").split("\n")) {
    const match = line.match(LINE_PATTERN);
    if (!match) continue;
    items.push({
      path: match[1].replace(/\\/g, "/").replace(/^\.\//, ""),
      line: Number(match[2]),
      description: match[3],
      confidence: Number(match[4]),
    });
  }
  return { available: true, items };
}
