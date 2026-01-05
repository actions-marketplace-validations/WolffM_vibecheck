# Test Fixtures

This directory contains intentionally "dirty" code to test all vibeCop analysis tools.

## Files and What They Test

| File | Tool(s) | Issues |
|------|---------|--------|
| `eslint-issues.ts` | ESLint | `no-unused-vars`, `no-var`, `prefer-const`, `eqeqeq`, `no-console` |
| `typescript-errors.ts` | TypeScript | Type mismatches, missing properties, implicit any |
| `duplicate-code-a.ts` + `duplicate-code-b.ts` | jscpd | ~60 lines of duplicated validation code |
| `security-issues.ts` | Semgrep, ESLint security | `eval()`, SQL injection, command injection, hardcoded secrets, XSS |
| `unused-exports.ts` | Knip | Exported but never imported functions, classes, types |
| `circular-dep-a.ts` + `circular-dep-b.ts` | dependency-cruiser | Circular import dependency |

## Expected Findings

When running vibeCop on this repo with test fixtures, we expect:

- **ESLint**: 5+ rule violations
- **TypeScript**: 5+ type errors
- **jscpd**: 1 duplicate block (~60 lines)
- **Semgrep/Security**: 8+ security issues
- **Knip**: 6 unused exports
- **dependency-cruiser**: 1 circular dependency

## Usage

```bash
# Run analysis including test-fixtures
npx tsx scripts/run-analyze.ts --cadence weekly
```
