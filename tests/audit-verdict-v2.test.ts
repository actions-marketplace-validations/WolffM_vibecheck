import { describe, expect, it } from "vitest";
import {
  buildFleetReport,
  inferMechanism,
  OPERATOR_RETRACTION,
  renderFleetReport,
} from "../src/audit/fleet-report.js";
import {
  fingerprintMatches,
  foldLedger,
  globToRegExp,
  isPatternFingerprint,
  resolveVerdict,
  type LedgerEvent,
  type VerdictEvent,
} from "../src/audit/ledger.js";

const anchorDate = "2026-08-27T00:00:00Z";

function verdict(
  fingerprint: string,
  v: VerdictEvent["verdict"],
  extra: Partial<VerdictEvent> = {},
): VerdictEvent {
  return {
    id: `01V${fingerprint.replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(23, "0").slice(0, 23)}`,
    at: "2026-08-18T00:00:00Z",
    verdict: v,
    fingerprint,
    reason: "because",
    ...extra,
  };
}

describe("growth invalidation is lane-aware", () => {
  // dataplatform's live failure: a config file justified on arrival
  // ("nothing can import a config") re-opened purely because the file
  // grew 72 -> 147 lines.
  const grown = new Map([["eslint.config.js", 147]]);

  it("does not re-open a structural verdict when the file merely grew", () => {
    const fold = foldLedger([
      verdict("arrival:eslint.config.js", "justified", {
        baseline: { codeLines: 72 },
      }),
    ]);
    const r = resolveVerdict(fold, "arrival:eslint.config.js", {
      anchorDate,
      codeLines: grown,
    });
    expect(r.status).toBe("justified");
    expect(r.suppressed).toBe(true);
  });

  it("still re-opens a size verdict when the file grew past the threshold", () => {
    const fold = foldLedger([
      verdict("size:src/big.ts", "justified", { baseline: { codeLines: 100 } }),
    ]);
    const r = resolveVerdict(fold, "size:src/big.ts", {
      anchorDate,
      codeLines: new Map([["src/big.ts", 200]]),
    });
    expect(r.status).toBe("reopened-growth");
    expect(r.suppressed).toBe(false);
  });
});

describe("detector-gap verdicts", () => {
  it("suppresses the finding but never ratchets the lane floor", () => {
    const gaps: LedgerEvent[] = [
      verdict("deadcode:a.py", "detector-gap", { mechanism: "decorator-registration" }),
      verdict("deadcode:b.py", "detector-gap", { mechanism: "decorator-registration" }),
      verdict("deadcode:c.py", "detector-gap", { mechanism: "decorator-registration" }),
      verdict("deadcode:d.py", "detector-gap", { mechanism: "decorator-registration" }),
    ];
    const fold = foldLedger(gaps);
    expect(
      resolveVerdict(fold, "deadcode:a.py", { anchorDate }).suppressed,
    ).toBe(true);
    // Four noise verdicts would have moved the floor; four gaps must not.
    expect(fold.floorSteps.get("deadcode") ?? 0).toBe(0);
    expect(fold.detectorGaps).toHaveLength(4);
  });

  it("noise still ratchets, so the two channels stay distinct", () => {
    const fold = foldLedger([
      verdict("deadcode:a.py", "noise"),
      verdict("deadcode:b.py", "noise"),
      verdict("deadcode:c.py", "noise"),
    ]);
    expect(fold.floorSteps.get("deadcode")).toBe(1);
  });
});

describe("pattern verdicts and file-level accept", () => {
  it("matches globs by segment, with ** crossing directories", () => {
    expect(globToRegExp("frontend/**/*.tsx").test("frontend/src/a/B.tsx")).toBe(true);
    expect(globToRegExp("frontend/**/*.tsx").test("frontend/B.tsx")).toBe(true);
    expect(globToRegExp("frontend/*.tsx").test("frontend/src/B.tsx")).toBe(false);
    expect(globToRegExp("src/*.ts").test("src/a.ts")).toBe(true);
  });

  it("recognises pattern fingerprints", () => {
    expect(isPatternFingerprint("arrival:frontend/**/*.tsx")).toBe(true);
    expect(isPatternFingerprint("*:themes/dev/editor.js")).toBe(true);
    expect(isPatternFingerprint("size:src/a.ts")).toBe(false);
  });

  it("answers a whole file class once (dataplatform filed 18 identical justifies)", () => {
    const fold = foldLedger([
      verdict("arrival:frontend/**/*.tsx", "justified", {
        reason: "covered by the Playwright suite the lane cannot see",
      }),
    ]);
    for (const path of [
      "frontend/src/components/ClipEditor.tsx",
      "frontend/src/hooks/useDualVideo.tsx",
    ]) {
      const r = resolveVerdict(fold, `arrival:${path}`, { anchorDate });
      expect(r.status).toBe("justified");
      expect(r.suppressed).toBe(true);
    }
    // A different lane on the same file is untouched.
    expect(
      resolveVerdict(fold, "size:frontend/src/components/ClipEditor.tsx", {
        anchorDate,
      }).status,
    ).toBe("none");
  });

  it("file-level accept closes the lane-swap escape", () => {
    // pygmalion: wontfix on size:BakeoffReview.tsx did not stop arrival
    // firing on the same frozen file.
    const fold = foldLedger([
      verdict("*:frontend/src/pages/BakeoffReview.tsx", "wontfix", {
        reason: "frozen; the bake-off format is retired",
      }),
    ]);
    for (const lane of ["size", "arrival", "smells"]) {
      expect(
        resolveVerdict(fold, `${lane}:frontend/src/pages/BakeoffReview.tsx`, {
          anchorDate,
        }).suppressed,
      ).toBe(true);
    }
  });

  it("prefers the most specific verdict, exact over pattern", () => {
    const fold = foldLedger([
      verdict("arrival:frontend/**/*.tsx", "justified"),
      verdict("arrival:frontend/src/Special.tsx", "wontfix"),
      verdict("*:frontend/src/Special.tsx", "noise"),
    ]);
    expect(
      resolveVerdict(fold, "arrival:frontend/src/Special.tsx", { anchorDate })
        .status,
    ).toBe("wontfix");
    expect(fingerprintMatches("*:x/y.ts", "size:x/y.ts")).toBe(true);
    expect(fingerprintMatches("size:x/y.ts", "arrival:x/y.ts")).toBe(false);
  });
});

describe("fleet report", () => {
  it("classifies mechanisms and excludes operator retractions", () => {
    expect(inferMechanism("all 12 are aiohttp handlers registered by @routes.get")).toBe(
      "decorator-registration",
    );
    expect(
      inferMechanism("command-station.astro mounts <ContactAdmin client:only=react>"),
    ).toBe("template-mount");
    expect(
      inferMechanism("an eslint flat config is not importable by a test"),
    ).toBe("unreachable-by-design");
    // A retraction quotes the old (wrong) reasoning; it must not be read
    // as a detector defect.
    expect(
      inferMechanism(
        "Superseded: the justify I filed said it was presentational — written without opening the file",
      ),
    ).toBe(OPERATOR_RETRACTION);
  });

  it("ranks mechanisms by repos affected, retractions excluded", () => {
    const report = buildFleetReport([]);
    expect(report.claims).toEqual([]);

    const synthetic = {
      repos: [],
      claims: [
        { repo: "a", fingerprint: "deadcode:x.py", lane: "deadcode", verdict: "detector-gap" as const, mechanism: "decorator-registration", reason: "r", at: "2026-08-20" },
        { repo: "b", fingerprint: "deadcode:y.py", lane: "deadcode", verdict: "noise" as const, mechanism: "decorator-registration", reason: "r", at: "2026-08-21" },
        { repo: "c", fingerprint: "size:z.ts", lane: "size", verdict: "noise" as const, mechanism: OPERATOR_RETRACTION, reason: "superseded", at: "2026-08-22" },
      ],
      byMechanism: [],
      byLane: [],
    };
    const text = renderFleetReport({
      ...synthetic,
      byMechanism: [
        { mechanism: "decorator-registration", repos: ["a", "b"], claims: 2 },
      ],
      byLane: [{ lane: "deadcode", repos: ["a", "b"], claims: 2 }],
    });
    expect(text).toContain("Detector claims: 2");
    expect(text).toContain("operator retractions excluded from the ranking: 1");
    expect(text).toContain("decorator-registration");
  });
});
