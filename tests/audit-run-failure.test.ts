import { describe, expect, it } from 'vitest';

import { describeRunFailure } from '../src/audit/runners/run-failure.js';

/**
 * These cover the shapes that used to lose the reason entirely. Each runner
 * reads its RESULT off stdout, so a tool that reports its failure there too was
 * being quoted from the empty stream — and two runners guarded the warning with
 * `if (run.stderr)`, so they printed nothing at all.
 */
describe('describeRunFailure', () => {
  const base = { error: undefined, status: 1, stdout: '', stderr: '' };

  it('reports a reason that arrived on stdout', () => {
    const out = describeRunFailure({ ...base, stdout: 'ERR_PNPM_NO_SCRIPT  Missing script' });
    expect(out).toContain('ERR_PNPM_NO_SCRIPT');
    expect(out).toContain('stdout:');
  });

  it('reports a reason that arrived on stderr', () => {
    const out = describeRunFailure({ ...base, stderr: 'command not found' });
    expect(out).toContain('command not found');
  });

  it('reports both streams when both spoke', () => {
    const out = describeRunFailure({ ...base, stdout: 'partial output', stderr: 'fatal' });
    expect(out).toContain('partial output');
    expect(out).toContain('fatal');
  });

  it('surfaces a spawn error, which has no streams at all', () => {
    const out = describeRunFailure({
      ...base,
      error: new Error('spawnSync npx ENOENT'),
      status: null,
    });
    expect(out).toContain('ENOENT');
  });

  it('never returns a blank reason', () => {
    const out = describeRunFailure(base);
    expect(out).toContain('no output on either stream');
    expect(out.trim()).not.toMatch(/[:·]\s*$/);
  });
});
