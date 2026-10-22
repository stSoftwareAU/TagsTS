# PR Summary — Issue #94

## Summary

Closes #94. `shellcheck.yml` limited its `pull_request` trigger to
`branches: ["*"]`. In GitHub Actions filter globs `*` does not match `/`, so a
PR based on `milestone/<slug>` never ran ShellCheck. The filter is now
`["*", "milestone/*"]`, the same fix PR #93 made to `gitleaks.yml`.

- [x] Change the `pull_request` filter in `.github/workflows/shellcheck.yml`
- [x] Pin the filter in `test/ShellCheckWorkflow.ts` with a positive and a
      negative assertion

## Spec

### Intent and Rationale

Every PR, including milestone sub-issue PRs, must be checked by ShellCheck.

### Essential Design Decisions

- **Explicit `milestone/*` entry**, because `*` stops at `/`.
- **The test parses the real workflow** and matches `Develop`, `main` and
  `milestone/issue-94-slug` against it with a local glob matcher. The matcher
  has no `RegExp`, and is copied from `test/GitleaksWorkflow.ts`. It is checked
  against GitHub's documented semantics (`*/*` matches `milestone/foo`, and `*`
  does not).
- **The negative assertion** shows that a bare `["*"]` does not match
  `milestone/issue-94-slug`, so the fixture can fail on the wrong input.

## Evidence

- `timeout 1000 ./quality.sh < /dev/null`: `ok | 123 passed | 0 failed`.
- **Docs sweep** — grep: `milestone`, `shellcheck`, `branches`; no hits needing
  a change. README.md, CONTRIBUTING.md and `docs/` (outside the archive) do not
  describe the workflow's branch filter. siblings: `gitleaks.yml` and
  `semgrep.yml` (the same filter family, #65 and #67). Neither is touched by
  this issue.
- No existing assertion was removed or loosened.

## Test Plan

- **Red first:** with only `.github/workflows/shellcheck.yml` reverted to the
  base, `shellcheck workflow runs on PRs targeting Develop, main and milestone
  branches` fails with `expected branch 'milestone/issue-94-slug' to match the
  pull_request filter`. The other five tests pass. Restored afterwards.
- **Callers/fakes:** none. The glob matcher is test-local.
- **Twinned rules:** `test/GitleaksWorkflow.ts` holds the same matcher. It is a
  per-file copy, as the repository's isolated workflow tests are. The helper's
  own test pins its semantics.
- <!-- vibe-branch-outcomes -->
  **Branch outcomes:** see `pr-summary-94.facts.json`. One outcome. Dropping
  `"milestone/*"` turns the milestone test red.

## Security Self-Check

- [x] No new permissions, secrets or `${{ github.* }}` interpolation.
- [x] No new third-party actions. The existing SHA pins are unchanged.
