## Summary

Quietens the every-change test gate by passing `--reporter=dot` to both
`deno test` invocations — `quality.sh` and the `Test` step of
`.github/workflows/quality.yml` — so a green run prints dots and one summary
line instead of a line per test. Failures still print their full name, assertion
message and stack trace. Closes #55.

- [x] Failing test for the quiet reporter contract (`test/QuietGate.ts`)
- [x] `--reporter=dot` added to `quality.sh` and `quality.yml`
- [x] README "Development" section notes the reporter
- [x] `./quality.sh` green

## Evidence

CLI/CI-only change; no UI to screenshot.

- TDD red: before the fix, `deno test --allow-read test/QuietGate.ts` failed
  (`4 passed | 2 failed`) — both the `quality.sh` and `quality.yml` checks
  reported the un-reported `deno test` command.
- TDD green: after the fix, `QuietGate.ts` + `QualityWorkflow.ts` pass
  (`16 passed | 0 failed`); the existing least-privilege checks on the CI
  `deno test` flags still pass.
- `./quality.sh < /dev/null` exits 0 and now prints dots ending in
  `ok | 40 passed | 0 failed`.

## Test Plan

- Added `test/QuietGate.ts`:
  - unit tests for `denoTestCommands` / `verboseCommands` (missing reporter,
    `--reporter=dot` and `--reporter dot` spellings, line continuations, a
    non-dot reporter, and lines that merely mention `deno test`);
  - repository checks that every `deno test` in `quality.sh` and in the quality
    workflow's `run:` scripts uses the dot reporter.
