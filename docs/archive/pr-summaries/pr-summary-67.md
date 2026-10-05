# PR Summary — Issue #67

## Summary

Closes #67. The `pull_request` filter in `.github/workflows/semgrep.yml` was
`branches: ["*"]`. A `*` in a GitHub Actions branch filter does not match `/`,
so PRs into `milestone/<slug>` skipped the Semgrep scan (finding
`BP-MILESTONE-FILTER-semgrep`). The filter is now `["**"]`, and
`test/SemgrepWorkflow.ts` guards it.

## Spec

### Intent and Rationale

- Milestone PRs must get the same SAST scan as PRs into `Develop` and `main`.

### Essential Design Decisions

- I used `["**"]` instead of the issue's example `[Develop, main, milestone/*]`.
  `["**"]` keeps the workflow's original all-branches intent. It also matches
  nested slugs, which `milestone/*` would miss for the same reason that `*`
  missed `milestone/<slug>`. This is the same fix PR #90 made to
  `markdown-lint.yml`.

### Undiscoverable Facts

- In GitHub's filter glob, `*` stops at `/` and `**` does not. That is why `"*"`
  looked like it matched every branch, but missed `milestone/<slug>`.

## Evidence

This change is CI-only, so there is no visual surface.

- `deno test -A test/SemgrepWorkflow.ts`:
  - before the workflow edit: `5 passed, 1 failed`, with
    `AssertionError: a pull_request branch filter must also match milestone/**`;
  - after it: `ok | 6 passed | 0 failed`.
- `actionlint .github/workflows/semgrep.yml` exited 0. `deno fmt --check` and
  `deno lint` were clean on the test file.
- `./quality.sh` exited 0, with `ok | 72 passed | 0 failed`.

**Docs sweep** — grep: `semgrep`, `branches`, `milestone` across `README.md`,
`AGENTS.md`, `docs/` and every `*.md` outside `docs/archive/`; no hits. No
manual documents the Semgrep trigger. The only explanation is the new comment at
`.github/workflows/semgrep.yml:12`, and it is still true because it states the
`**` and `*` behaviour that this change relies on.

## Test Plan

- New tests in `test/SemgrepWorkflow.ts`:
  - "semgrep pull_request branch filter matches milestone/\*\* branches"
    (positive). It is red on the base workflow and green on this head.
  - "milestone filter guard rejects filters that skip milestone branches"
    (negative). It checks that `["*"]`, `["Develop","main"]`, `["milestone/*"]`
    and the non-array `"**"` are rejected, and that `["**"]`,
    `[..., "milestone/**"]` and `undefined` are accepted.
- Mutation checks:
  - reverting the workflow to `["*"]` turns the positive test red;
  - changing `filterMatchesMilestone` to `return true` turns the negative test
    red.
- Branch outcomes:
  - `test/SemgrepWorkflow.ts:84`: `undefined`, meaning no filter, which runs on
    every branch. Accepted, in the negative test. Not mutation-run: removing the
    line makes `undefined` fall through to `false`, which the test asserts
    against.
  - `test/SemgrepWorkflow.ts:85`: an array containing `**` or `milestone/**`.
    Accepted, in the positive and negative tests. Mutation results are above.
  - `test/SemgrepWorkflow.ts:85`: a non-array, or an array missing both
    patterns. Rejected, in the negative test.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
