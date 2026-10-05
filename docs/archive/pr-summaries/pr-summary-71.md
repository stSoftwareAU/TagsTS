# PR Summary — Issue #71

## Summary

Closes #71. The Gitleaks workflow's `actions/checkout` step now sets
`persist-credentials: false`, so the job's `GITHUB_TOKEN` is not written into
`.git/config` for later steps to read. `fetch-depth: 0` and the existing pinned
SHA are unchanged.

- [x] Failing test for the gitleaks checkout (red on base)
- [x] Add `persist-credentials: false` to `.github/workflows/gitleaks.yml`
- [x] Extend the workflow validator (`test/GitleaksWorkflow.ts`) with positive
      and negative cases
- [x] `./quality.sh` green

## Spec

### Intent and Rationale

- Finding `BP-PERSIST-CREDS-gitleaks`: a persisted checkout token can be read by
  any later step, including third-party action code.
- Fixed rather than suppressed with `# best-practice-ignore`, because no later
  step needs the git credential.

### Essential Design Decisions and Undiscoverable Facts

- `gitleaks-action` gets its token from the `GITHUB_TOKEN` env var, not from git
  config, so it is unaffected.
- The `Fetch base branch` step runs `git fetch origin` anonymously. That works
  because `stSoftwareAU/TagsTS` is public (`gh repo view --json visibility` →
  `PUBLIC`).
- `fetch-depth: 0` is kept, and the test pins it, because gitleaks scans the
  PR's commit range.
- `checkoutsPersistingCredentials` accepts only a strict boolean `false`. A
  missing `with:`, a missing key, or `true` are all flagged.

## Evidence

- Red on base: the real-workflow test failed with
  `Actual ["actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"] / Expected []`.
- Green after the fix: `deno test -A test/GitleaksWorkflow.ts` passed 9 of 9
  tests, and `./quality.sh` passed 87 tests with 0 failures.
- Docs sweep: a grep for `persist.?credential` across `*.md` (excluding PR
  summaries) found no hits. `README.md`, `CONTRIBUTING.md` and `SECURITY.md` do
  not mention gitleaks, so there is no prose to update.
- Related existing rules checked: the `persist-credentials: false` tests for the
  other workflows, such as `test/MarkdownLintWorkflow.ts`, which issues #61–#64
  added. This change follows the same pattern.

## Test Plan

- `test/GitleaksWorkflow.ts` → "checkoutsPersistingCredentials flags checkout
  steps missing persist-credentials: false" covers:
  - a `false` value, which passes;
  - a missing key, a missing `with:` and `true`, which are flagged;
  - non-checkout steps, which are ignored.
- `test/GitleaksWorkflow.ts` → "gitleaks job checks out without persisted
  credentials, keeping full history" reads the real
  `.github/workflows/gitleaks.yml`. It failed before the workflow edit and
  passes after it.

Branch outcomes:

- `test/GitleaksWorkflow.ts` `checkoutsPersistingCredentials`:
  - **Non-checkout step ignored.** Covered by the helper test's
    `gitleaks-action` and `run` case.
  - **Checkout with `persist-credentials: false` passes.** Covered by the helper
    test's first case and the real-workflow test.
  - **Checkout without it is flagged.** Covered by the helper test's
    missing-key, missing-`with` and `true` cases.
  - **Mutation check.** I flipped the `!== false` guard to `=== "never"`, which
    flags nothing. The helper test went red (`FAILED | 8 passed | 1 failed`),
    then I restored the guard.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
