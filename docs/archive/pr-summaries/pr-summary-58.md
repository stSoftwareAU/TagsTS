# PR summary — Issue #58: CI lint gate for GitHub Actions

## Summary

Closes #58

- Adds `.github/workflows/actionlint.yml`: runs `rhysd/actionlint` (with
  `-color`, bundling shellcheck) on every pull request, so workflow regressions
  fail the build.
- The image is pinned to its immutable digest
  (`rhysd/actionlint@sha256:b1934ee5…` = tag `1.7.12`, resolved from Docker Hub
  in this run); `actions/checkout` is SHA-pinned (`v4.4.0`, resolved via
  `gh api`). Workflow and job hold `contents: read`; checkout sets
  `persist-credentials: false`; no push trigger and no branch filter, so
  `milestone/**` PRs are covered.
- Fixes the one existing finding the new gate reports: SC2086 (unquoted
  `$GITHUB_OUTPUT`) in `.github/workflows/github-release.yml`.
- `test/ActionlintWorkflow.ts` pins the gate's contract (triggers, permissions,
  credentials, digest-pinned image).
- README gains a **Workflow lint** section; cspell learns `actionlint` and
  `rhysd`.

- [x] Failing contract test first
- [x] actionlint workflow added
- [x] Existing workflows lint clean
- [x] README and spell-check words updated
- [x] Quality gate

## Evidence

Backend/CI change — no visual surface.

```mermaid
flowchart LR
    PR[Pull request] --> C[checkout, no persisted credentials]
    C --> A[docker://rhysd/actionlint@sha256 -color]
    A -- clean --> OK[Check passes]
    A -- finding --> F[Check fails]
```

- Before the fix, `actionlint -color=false` (v1.7.12) exited 1:
  `github-release.yml:22:9: shellcheck reported issue in this script: SC2086`.
  After the fix it exits 0 over all workflows.
- `test/ActionlintWorkflow.ts`: 4 failed before the workflow existed and 4
  passed after it was added.

## Test Plan

- `actionlint -color` exits 0.
- `deno test --allow-read test/ActionlintWorkflow.ts test/ActionPins.ts` passes.
- `./quality.sh` passes.
