/**
 * Rust Tool Runners
 *
 * Runners for Rust analysis tools: Clippy, cargo-audit, cargo-deny
 */

import { spawnSync } from "node:child_process";
import type { Finding } from "../../core/types.js";
import { isToolAvailable, safeParseJson } from "../tool-utils.js";
import {
  parseClippyOutput,
  parseCargoAuditOutput,
  parseCargoDenyOutput,
  type CargoAuditOutput,
  type CargoDenyOutput,
} from "../../parsers.js";
import { MAX_OUTPUT_BUFFER } from "../../utils/shared.js";

/** Directories to exclude for Rust (comma-separated) */
export const EXCLUDE_DIRS_RUST = "target,.cargo";

/**
 * Run Clippy linter for Rust code.
 */
export function runClippy(rootPath: string, _configPath?: string): Finding[] {
  console.log("Running clippy...");

  try {
    // Check if cargo is available
    const { available } = isToolAvailable("cargo", false);
    if (!available) {
      console.log("  Cargo not installed, skipping clippy");
      return [];
    }

    // Run clippy with JSON message format
    // Note: clippy outputs to stderr, so we need to capture that
    const args = [
      "clippy",
      "--message-format=json",
      "--all-targets",
      "--",
      "-W",
      "clippy::all",
      "-W",
      "clippy::pedantic",
    ];

    const result = spawnSync("cargo", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
    });

    // Clippy outputs JSON messages to stdout, one per line
    const output = result.stdout || "";
    const messages: unknown[] = [];

    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          // Only keep compiler_message type entries
          if (parsed.reason === "compiler-message" && parsed.message) {
            messages.push(parsed.message);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    if (messages.length > 0) {
      return parseClippyOutput(messages);
    }
  } catch (error) {
    console.warn("clippy failed:", error);
  }

  return [];
}

/**
 * Run cargo-audit to check for security vulnerabilities in dependencies.
 */
export function runCargoAudit(rootPath: string): Finding[] {
  console.log("Running cargo-audit...");

  try {
    // Check if cargo-audit is available
    const { available } = isToolAvailable("cargo-audit", false);
    if (!available) {
      console.log("  cargo-audit not installed, skipping");
      return [];
    }

    const args = ["audit", "--json"];

    const result = spawnSync("cargo", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
    });

    // cargo-audit outputs JSON to stdout
    const output = result.stdout || "";
    const parsed = safeParseJson<CargoAuditOutput>(output);
    if (parsed) {
      return parseCargoAuditOutput(parsed);
    }
  } catch (error) {
    console.warn("cargo-audit failed:", error);
  }

  return [];
}

/**
 * Run cargo-deny to check dependencies for licenses, bans, advisories, and sources.
 */
export function runCargoDeny(rootPath: string, configPath?: string): Finding[] {
  console.log("Running cargo-deny...");

  try {
    // Check if cargo-deny is available
    const { available } = isToolAvailable("cargo-deny", false);
    if (!available) {
      console.log("  cargo-deny not installed, skipping");
      return [];
    }

    const args = ["deny", "check", "--format", "json"];
    if (configPath) {
      args.push("--config", configPath);
    }

    const result = spawnSync("cargo", args, {
      cwd: rootPath,
      encoding: "utf-8",
      shell: true,
      maxBuffer: MAX_OUTPUT_BUFFER,
    });

    // cargo-deny outputs JSON to stdout (one JSON object per line for each diagnostic)
    const output = result.stdout || "";
    const diagnostics: unknown[] = [];

    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{")) {
        try {
          diagnostics.push(JSON.parse(trimmed));
        } catch {
          // Skip malformed lines
        }
      }
    }

    if (diagnostics.length > 0) {
      return parseCargoDenyOutput({ diagnostics } as CargoDenyOutput);
    }
  } catch (error) {
    console.warn("cargo-deny failed:", error);
  }

  return [];
}
