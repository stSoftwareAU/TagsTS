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
- `./quality.sh < /dev/null`: `ok | 72 passed | 0 failed`, exit 0.
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
  `milestone/a/b`.
- `test/GitleaksWorkflow.ts`, test
  `gitleaks workflow runs on PRs targeting Develop, main and milestone branches`.
  It failed on the base branch and passes with the fix.
- No assertions were removed.
- Branch outcomes: none added. The workflow change is configuration only.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
