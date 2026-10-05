# PR Summary — Issue #63: stop the ShellCheck checkout persisting credentials

## Summary

Closes #63.

The `actions/checkout` step in `.github/workflows/shellcheck.yml` (job
`shellcheck`, step 0) now sets `persist-credentials: false`, which clears
finding `BP-PERSIST-CREDS-shellcheck`. A new test in
`test/ShellCheckWorkflow.ts` pins the setting.

## Spec

### Intent and Rationale

The only step after the checkout is `ludeeus/action-shellcheck`, which reads the
tree and never pushes. Nothing needs the `GITHUB_TOKEN` left in `.git/config`,
so removing it shrinks the token's exposure at no cost.

### Essential Design Decisions

- **Fix, not suppress.** The job has no push step, so a `best-practice-ignore`
  comment would not be justified.
- **The SHA pin and its version comment are unchanged.** Only a `with:` block
  was added.
- **The test covers every checkout in the job**, so a second checkout added
  later must also opt out.

### Undiscoverable Facts

- The repository is public, and its default branch is `Develop`.
- This applies the same fix as #62 (PR #91, semgrep workflow) to the ShellCheck
  workflow.

## Evidence

- Red: `deno test --allow-all test/ShellCheckWorkflow.ts` without the workflow
  change gave `FAILED | 3 passed | 1 failed` (`undefined` instead of `false`).
- Green: after the change, the same command gave `ok | 4 passed | 0 failed`.
- `actionlint .github/workflows/shellcheck.yml`: exit 0.
- `./quality.sh < /dev/null`: `ok | 70 passed | 0 failed`, exit 0.
- Docs sweep: grep for `persist`, `persist-credentials` and `shellcheck` across
  README.md, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md and docs/ (excluding
  docs/archive/). Section: none. README.md:192 and README.md:204 mention
  actionlint's built-in shellcheck integration, not this workflow's checkout, so
  both are still accurate.

## Test Plan

- New test `shellcheck workflow checks out without persisted credentials` in
  `test/ShellCheckWorkflow.ts`. It failed before the workflow change and passes
  after it.
- No assertions were removed.
- Branch outcomes: none added.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
