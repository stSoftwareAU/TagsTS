# PR Summary — Issue #62

## Summary

Closes #62. The `semgrep` job's `actions/checkout` step in
`.github/workflows/semgrep.yml` now sets `persist-credentials: false`. This
stops `GITHUB_TOKEN` being written into `.git/config` (finding
BP-PERSIST-CREDS-semgrep). `test/SemgrepWorkflow.ts` now asserts the setting.

## Spec

### Intent and Rationale

- The next step, `semgrep ci`, runs a third-party container image that also
  holds `SEMGREP_APP_TOKEN`. A token persisted on disk is readable by that step,
  and nothing in the job needs it.

### Essential Design Decisions

- I fixed the finding rather than suppressing it with `# best-practice-ignore`,
  because no step in the job pushes.
- The existing checkout SHA and its `# actions/checkout@v4.3.1` comment are kept
  verbatim. This PR does not bump the pin.

### Undiscoverable Facts

- The repository is public (`gh repo view --json isPrivate` returns `false`). If
  `semgrep ci` needs to fetch the base commit for a diff-aware scan, an
  anonymous fetch is enough, so it does not need the persisted token.

## Evidence

This change is CI-only, so there is no visual surface.

- `deno test --allow-all test/SemgrepWorkflow.ts`:
  - with the workflow edit reverted, it gave `3 passed, 1 failed`. The new test
    failed with `Actual: undefined / Expected: false`;
  - with the fix, it gave `ok | 4 passed | 0 failed`.
- `actionlint .github/workflows/semgrep.yml` exited 0.
- `./quality.sh` exited 0 with `ok | 69 passed | 0 failed`.

**Docs sweep** — grep: `persist`, `persist-credentials`, `semgrep`, `checkout`
across `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` and `docs/`
(excluding `docs/archive/`); section: none — no manual documents the semgrep
workflow (`docs/` holds only `archive/`, and the README `## Development`
subsections cover the quality gate, dependency quarantine, workflow lint and
release SBOM, not semgrep); no hits

## Test Plan

- `test/SemgrepWorkflow.ts` gains the test "semgrep workflow checks out without
  persisted credentials". It asserts that every `actions/checkout@` step in
  `jobs.semgrep` has `with.persist-credentials === false`. It is red against the
  base workflow and green on this head.
- No assertions were removed.
- Branch outcomes: none added. The test's `checkouts.length > 0` guard is
  test-side only. It stops the loop passing without checking anything if the
  checkout step disappears.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
