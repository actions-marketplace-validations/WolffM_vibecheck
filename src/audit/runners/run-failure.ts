/**
 * One description of why an external analyzer run failed.
 *
 * Every runner here shells out to a tool and reads its RESULT off stdout. The
 * tempting failure path is to quote `stderr` — but a tool that reports on
 * stdout then produces an empty reason, and the two runners that guarded the
 * warning with `if (run.stderr)` printed *nothing at all*. In an audit that is
 * the expensive failure: a runner that silently returns no findings is
 * indistinguishable from a clean result, so the report reads green.
 *
 * type-coverage.ts already had this right, with a comment naming the incident
 * ("round-8: CI degradation was undiagnosable"). This is that logic, lifted so
 * every runner states its case the same way.
 */
import type { SpawnSyncReturns } from "node:child_process";

const tail = (text: string | null | undefined): string =>
  (text ?? "").trim().split("\n").slice(-2).join(" | ");

export function describeRunFailure(
  run: Pick<SpawnSyncReturns<string>, "error" | "status" | "stdout" | "stderr">,
): string {
  const parts = [
    run.error?.message,
    `status ${run.status}`,
    tail(run.stderr) && `stderr: ${tail(run.stderr)}`,
    tail(run.stdout) && `stdout: ${tail(run.stdout)}`,
  ].filter(Boolean);
  // Never return an empty reason — "no output on either stream" is itself a
  // diagnosis (the tool died before it could say anything).
  return parts.length > 1 ? parts.join(" · ") : `${parts[0] ?? ""} · no output on either stream`;
}
