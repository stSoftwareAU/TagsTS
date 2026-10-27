# PR Summary — Issue #96

## Summary

Closes #96. The `pull_request` trigger of
`.github/workflows/dependency-review.yml` was limited to
`branches: ["Develop"]`, so PRs into `milestone/<slug>` branches were never
dependency-reviewed. It is now `branches: ["Develop", "milestone/*"]`.

- [x] Add `"milestone/*"` to the branch filter
- [x] Add `test/DependencyReviewWorkflow.ts`, which parses the workflow and
      checks the filter against real branch names
- [x] Move the branch-glob matcher out of `test/GitleaksWorkflow.ts` into
      `test/support/BranchFilter.ts`, shared by both tests

## Spec

### Intent and Rationale

- Same gap as gitleaks (#65), semgrep (#67), markdown-lint (#66) and shellcheck
  (#94): GitHub's `*` glob does not match `/`, so `Develop` alone skips
  milestone PRs.

### Essential Design Decisions

- The issue's `milestone/*` is used (single level, as the issue states); a
  nested `milestone/a/b` is deliberately not matched, and a test pins that.
- The matcher was moved, not copied, so there is one glob implementation. It is
  in `test/support/` and imported by a test so the mutation gate can see it (the
  earlier attempt put helpers in the test file itself, which no test imported).

### Undiscoverable Facts

- None.

## Evidence

- Backend/CI config only; no UI. `./quality.sh < /dev/null`:
  `ok | 152 passed | 0 failed`.
- The workflow `types` list is unchanged (draft-PR skipping from #110 is
  intact).

## Test Plan

No assertion was removed from an existing test. `test/GitleaksWorkflow.ts` only
lost the two helper functions (now in `test/support/BranchFilter.ts`, unchanged
apart from `deno fmt` wrapping the signature); its tests are unchanged and pass.

New tests in `test/BranchFilter.ts` (pin the shared matcher directly):

- "branch filter '**' backtracks and reports no match when the tail never
  matches"
- "branch filter literal pattern longer than the branch does not match"
- "branch filter '*' matches within one path segment only"

New tests in `test/DependencyReviewWorkflow.ts`:

- "dependency-review pull_request filter matches Develop and milestone branches"
- "dependency-review pull_request filter does not match unrelated or nested
  branches"
- "dependency-review workflow still runs on
  opened/synchronize/reopened/ready_for_review"

Red checks (each restored afterwards):

- Filter reverted to `["Develop"]` → the first test goes red.
- Filter widened to `["Develop", "**"]` → the second test goes red
  (`milestone/a/b` matches).
- Removing `if (text[i] === "/") break;` from the matcher → the second new test
  and "gitleaks branch filter helper mirrors GitHub glob semantics" go red.

**Docs sweep** — grep: `dependency-review`, `branches` over `README.md`,
`CONTRIBUTING.md`, `SECURITY.md` and `CHANGELOG.md`; section: none — no manual
documents this workflow's branch filter; siblings: the other workflows'
milestone filters (`gitleaks.yml`, `semgrep.yml`) already cover milestone
branches; no hits, no doc updated.

**Branch outcomes:**

- `.github/workflows/dependency-review.yml:17` — `milestone/*` entry matches a
  milestone PR base —
  `test/DependencyReviewWorkflow.ts::dependency-review pull_request filter matches Develop and milestone branches`
  — flipped to `["Develop"]`, test went red
- `.github/workflows/dependency-review.yml:17` — filter does not match nested or
  unrelated branches —
  `test/DependencyReviewWorkflow.ts::dependency-review pull_request filter does not match unrelated or nested branches`
  — flipped to `"**"`, test went red
- `test/support/BranchFilter.ts:52` — single `*` stops at `/` —
  `test/DependencyReviewWorkflow.ts::dependency-review pull_request filter does not match unrelated or nested branches`
  — removed the `break`, test went red

## Mutation survivors

`test/support/BranchFilter.ts` is imported by `test/GitleaksWorkflow.ts`,
`test/DependencyReviewWorkflow.ts` and the new `test/BranchFilter.ts`, so the
gate's "no test imports this module" is wrong for it. Each listed mutation was
applied by hand and run with `deno test`; all were already killed except three,
fixed here:

- `:33` `textIndex < text.length` (now removed): the operand was dead —
  `text[textIndex]` is `undefined` past the end and never equals a pattern
  character — so the line is simplified to the equality check alone; replacing
  that equality with `true` turns the tests red.
- `:41` negated `if` in the `**` loop and `:45` `return false` → `true`:
  `test/BranchFilter.ts` "branch filter '**' backtracks and reports no match
  when the tail never matches" goes red for each (verified).

Remaining entries are in leaf test files that nothing imports, so the harness
cannot observe a mutation of them; run directly they do go red.

- `test/DependencyReviewWorkflow.ts:15` exempt (untestable): deleted `parse`
  call inside a test body; no module imports the file
- `test/DependencyReviewWorkflow.ts:40` exempt (untestable): the `false`
  expected value of an assertion inside a test body; no module imports the file
- `test/DependencyReviewWorkflow.ts:52`, `:53`, `:54`, `:55` exempt
  (untestable): elements of the expected `types` array inside a test body; no
  module imports the file

🤖 Generated with [Claude Code](https://claude.com/claude-code)
