# PR Summary — Issue #65: run gitleaks on milestone PRs

## Summary

Closes #65.

The `pull_request` filter in `.github/workflows/gitleaks.yml` changes from
`branches: ["*"]` to `branches: ["*", "milestone/*"]`. Pull requests that target
`milestone/<slug>` branches are now scanned, which clears finding
`BP-MILESTONE-FILTER-gitleaks`. The new `test/GitleaksWorkflow.ts` pins the
filter.

## Spec

### Intent and Rationale

In a GitHub Actions filter glob, `*` does not match `/`. A milestone branch
therefore never matched `"*"`, and its sub-issue PRs skipped the secrets scan.

### Essential Design Decisions

- **`"*"` stays, and `milestone/*` is added beside it.** The issue's example
  (`[Develop, main, milestone/*]`) would stop scans on PRs that target other
  top-level branches. Keeping `"*"` means no PR that is scanned today stops
  being scanned.
- **One level of glob is enough.** Milestone slugs contain no nested slashes.
- **The test parses the YAML** and checks the filter with a small helper that
  copies GitHub's `*` and `**` rules. A separate test pins the helper itself,
  including the case where `"*"` does not match a milestone branch.
- **The single-`*` loop tries a match before checking for `/`.** Review caught
  that the original loop condition (`text[i] !== "/"`) stopped the loop before
  it ever tried matching the rest of the pattern at the `/` position, so a
  pattern such as `*/*` or `releases/*/hotfix` could never match. The loop body
  now calls `globMatch` first and only then breaks on `/`.

### Undiscoverable Facts

- `semgrep.yml` and `shellcheck.yml` use the same `["*"]` filter. They are out
  of scope here and have their own audit findings.

## Evidence

- Red: with only the test added, `deno test -A test/GitleaksWorkflow.ts` gave
  `FAILED | 1 passed | 1 failed`, with the message
  `expected branch 'milestone/issue-65-slug' to match the pull_request filter`.
- Green: after the workflow change, the same command gave
  `ok | 2 passed | 0 failed`.
- `deno fmt --check`, `deno lint`, `deno check test/GitleaksWorkflow.ts` and
  `actionlint .github/workflows/gitleaks.yml` all passed cleanly.
- `./quality.sh < /dev/null`: `ok | 79 passed | 0 failed`, exit 0.
- Review round 2 (PR #93): reverting the single-`*` loop fix and re-running
  `deno test -A test/GitleaksWorkflow.ts` gave `FAILED | 6 passed | 1 failed` on
  `gitleaks branch filter helper mirrors GitHub glob semantics`
  (`matchesBranchFilter("milestone/foo", ["*/*"])` returned `false` instead of
  `true`). Restoring the fix returns `ok | 7 passed | 0 failed`.
- **Docs sweep** — grep: `gitleaks`, `milestone`; section: none — no manual
  documents the gitleaks workflow or its branch filter. Also grepped
  `gitleaks.yml`, `base_ref` and "secret" across README.md, CONTRIBUTING.md,
  SECURITY.md, CHANGELOG.md, docs/ (excluding docs/archive/) and every
  `*/README.md`. README `#workflow-lint` covers only actionlint and CONTRIBUTING
  `#quality-gate` covers only `quality.yml`; both were read through and stay
  true; no hits

## Test Plan

- `test/GitleaksWorkflow.ts`, test
  `gitleaks branch filter helper mirrors GitHub glob semantics`. This is the
  negative check: `"*"` rejects `milestone/foo`, and `milestone/*` rejects
  `milestone/a/b`. Review round 2 added four more assertions pinning that a `*`
  immediately followed by `/` still matches: `*/*` and `*/foo` against
  `milestone/foo`, `releases/*/hotfix` against `releases/v1/hotfix`, and the
  combined filter `["*", "*/*"]` against `milestone/issue-65-slug`. Each one
  fails on the unfixed loop (see Evidence).
- `test/GitleaksWorkflow.ts`, test
  `gitleaks workflow runs on PRs targeting Develop, main and milestone branches`.
  It failed on the base branch and passes with the fix.
- No assertions were removed.
- Branch outcomes: none added. The workflow change is configuration only.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
