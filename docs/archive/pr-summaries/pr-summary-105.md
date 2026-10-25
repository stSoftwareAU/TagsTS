# PR Summary — Issue #105

## Summary

Closes #105. `dependency-review.yml` pinned `actions/dependency-review-action`
to v4.9.0 (`2031cfc0…`), which runs on the deprecated `node20` Actions runtime.
It is now pinned to
`actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5.0.0`.
The `with:` options are unchanged.

- [x] Re-pin `.github/workflows/dependency-review.yml` to v5.0.0
- [x] Add a node20 denylist guard for the action to `test/ActionPins.ts`
      (`NODE20_DEPENDENCY_REVIEW_SHAS`, `usesNode20DependencyReview`,
      `scanDependencyReview`) with positive, negative and fixture tests
- [x] Add `test/ActionPinsScan.ts`, which imports `test/ActionPins.ts` and tests
      `scanDependencyReview` directly
- [x] Add `test/ActionPins_test.ts` to import both modules under Deno's default
      test discovery and verify that three guard assertions reject faulty
      fixtures
- [x] All 24 mutations from the completion check go red in scratch copies

## Spec

### Intent and Rationale

Same finding as #72 for `actions/checkout`: GitHub removed the `node20` runtime
on 2026-09-16, so a node20 action warns and later breaks. The fix re-pins to the
node24 release instead of suppressing the finding.

### Essential Design Decisions and Undiscoverable Facts

- The guard is a denylist of known node20 SHAs (only v4.9.0 today), mirroring
  `NODE20_CHECKOUT_SHAS`, so a future node24 bump needs no test edit.
- The scan was extracted into `scanDependencyReview(docs)` so a fixture workflow
  containing a node20 pin can prove the offender collection works. The
  real-workflow test only proves it while the repo is clean.
- The checkout-guard comment in the file header gained a mention of this issue.

## Evidence

- `deno test -A test/ActionPinsScan.ts`: 13 passed, 0 failed (the 10 tests of
  `test/ActionPins.ts` plus 3 new ones, since the import runs them too).
- `deno test -A test/ActionPins_test.ts`: 16 passed, 0 failed (the same 13 tests
  plus three tests that exercise assertion removal).
- Full suite, using the `deno test` command from `quality.sh`: 154 passed, 0
  failed.
- `deno lint test/ActionPins_test.ts`: passed.

**v5.0.0 review** (checked with `gh api` on 2026-10-22):

- Release: `v5.0.0` published 2026-05-08T20:23:50Z, about 5 months before this
  change, so it is far outside the 24h quarantine (`minimumDependencyAge` is
  `P1D`). The tag resolves to `a1d282b36b6f3519aa1f3fc636f609c47dddb294`
  (committed 2026-05-08T20:20:49Z), the SHA now pinned.
- Changelog (release notes, full diff `v4.9.0...v5.0.0`): "a new major version
  ... which updates the runtime to node24" (PR #1084). Other changes are a
  Copilot instructions file, a `spdx-license-ids` bump, docs examples moving to
  `actions/checkout@v6`, a fix to patched-version display for non-strict semver
  ranges, and security-finding fixes. No input or behaviour change is listed.
  The only breaking change is a minimum Actions runner of v2.327.1, which
  `runs-on: ubuntu-latest` (GitHub-hosted) satisfies.
- Inputs: `action.yml` at v4.9.0 and v5.0.0 differ in exactly one line,
  `using: 'node20'` -> `using: 'node24'` (`diff` of the two files). So every
  input, including `comment-summary-in-pr` (the one the workflow sets to
  `always`), is unchanged.
- `action.yml` at `a1d282b36b6f3519aa1f3fc636f609c47dddb294` declares
  `using: 'node24'`; at the old `2031cfc0…` it declares `using: 'node20'`.
- The guard is a denylist and does not itself prove the new SHA is node24; that
  was verified here by reading `action.yml`, as above.

**Docs sweep** — grep: `node20`, `dependency-review`, `2031cfc0` over
`README.md`, `CONTRIBUTING.md`, `SECURITY.md` and `docs/` (excluding
`docs/archive/`); section: none — no manual documents the dependency-review
action pin; siblings: `actions/checkout` node20 guard in `test/ActionPins.ts` —
the new guard sits beside it and the checkout guard is unchanged; no hits, so no
doc updated.

## Test Plan

The only line removed from an existing file's test code is a comment, so no
assertion was removed:

- Removed from `test/ActionPins.ts`:
  `// runtime, which GitHub removed on 2026-09-16 (issue #72).` Replaced by:
  `// runtime, which GitHub removed on 2026-09-16 (issue #72), and` — the
  comment was reworded to also mention issue #105; it is not an assertion.

New tests, all in `test/ActionPins.ts`:

- "usesNode20DependencyReview flags the known node20 SHA" (positive).
- "usesNode20DependencyReview accepts node24 v5.0.0 and unrelated actions"
  (negative: v5.0.0, other action, checkout with that SHA, local action).
- "scanDependencyReview lists a node20 pin and counts every reference" (fixture
  with one node20 pin, one node24 pin and an unrelated action; plus an empty
  workflow).
- "no workflow pins actions/dependency-review-action to a node20 runtime
  release" parses every real workflow and asserts no offenders and
  `checked > 0`.

New tests in `test/ActionPinsScan.ts`: "scanDependencyReview returns an object
for an empty list", "aggregates counts and offenders across files" and "finds a
job-level reference and ignores others".

`test/ActionPins_test.ts` imports both modules so default `deno test` discovers
them. Its three additional tests run isolated copies in temporary directories:

- "dependency-review negative test rejects a misclassified local action" injects
  a classifier fault that reports local actions as node20. Removing the local
  action assertion makes this faulty classifier pass the negative test, which
  fails the outer test.
- "dependency-review empty-list test rejects an incorrect scan count" injects a
  count of one for an empty list. Removing the empty-list assertion makes this
  faulty scan pass, which fails the outer test.
- "dependency-review workflow guard rejects an empty workflow directory" runs
  with an empty `.github/workflows` directory and requires the specific "no
  workflows found" assertion failure. Removing that assertion leaves only the
  later vacuous-scan error, which fails the outer test.

The subprocess checks require an assertion failure and exactly one failed test;
an import, syntax or type-check error cannot satisfy them. Temporary copies are
removed after each run. No guard implementation or workflow pin changes were
needed for the completion-check fix.

**Branch outcomes:**

- `test/ActionPins.ts:50` — `usesNode20DependencyReview` true for a known node20
  SHA, false for an unknown/node24 SHA —
  `test/ActionPins.ts::usesNode20DependencyReview flags the known node20 SHA`
  and
  `test/ActionPins.ts::usesNode20DependencyReview accepts node24 v5.0.0 and unrelated actions`
  — flipped the SHA lookup to `true`, 3 tests went red
- `test/ActionPins.ts:49` — other action (not dependency-review-action) → false
  —
  `test/ActionPins.ts::usesNode20DependencyReview accepts node24 v5.0.0 and unrelated actions`
  (the `other/action@` and `actions/checkout@` cases)
- `test/ActionPins.ts:201` — non-dependency-review reference skipped —
  `test/ActionPins.ts::scanDependencyReview lists a node20 pin and counts every reference`
  — negated the condition, test went red
- `test/ActionPins.ts:202` — `checked` counts each matching reference
  (vacuous-scan input) —
  `test/ActionPins.ts::scanDependencyReview lists a node20 pin and counts every reference`
  — removed `checked++`, 2 tests went red
- `test/ActionPins.ts:204` — node20 reference is an offender, node24 is not —
  `test/ActionPins.ts::scanDependencyReview lists a node20 pin and counts every reference`
  — negated the condition, 2 tests went red
- `test/ActionPins.ts:205` — offender recorded —
  `test/ActionPins.ts::scanDependencyReview lists a node20 pin and counts every reference`
  — removed the `push`, test went red
- `test/ActionPins.ts:241` — vacuous-scan guard (`checked > 0`) fails when no
  reference is found —
  `test/ActionPins.ts::no workflow pins actions/dependency-review-action to a node20 runtime release`;
  `test/ActionPinsScan.ts::scanDependencyReview returns an object for an empty list`
  checks the empty-scan count directly, and deleting the `docs.push` call on the
  real-workflow path makes the guard fail
- `.github/workflows/dependency-review.yml:36` — pin is node24 v5.0.0 —
  `test/ActionPins.ts::no workflow pins actions/dependency-review-action to a node20 runtime release`
  — restoring the v4.9.0 SHA goes red

## Mutation check

Required item 1 reported 24 surviving mutations across `test/ActionPins.ts` and
`test/ActionPinsScan.ts`. Neither filename matches Deno's default test discovery
pattern. `test/ActionPins_test.ts` now imports both, and the fault fixtures
above also detect the three assertion deletions that merely importing the
modules would not catch.

All 24 mutations were applied individually to scratch copies and run using
`deno test -A --no-check` with default discovery: **24 killed, 0 survived**.
Type checking was disabled for this experiment so runtime test failures, rather
than compiler errors, establish the result. Each run exited unsuccessfully with
failed tests and an `AssertionError`. Line numbers below refer to the unchanged
guard modules quoted in the notice.

| File and lines                                   | Mutations checked                                    | Runtime evidence                                                                  |
| ------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `test/ActionPins.ts:49`                          | Replace action comparison with `true`                | Unrelated-action negative cases fail                                              |
| `test/ActionPins.ts:50`                          | Delete lookup call; replace lookup with `true`       | Known-node20 positive case; node24 negative case fail respectively                |
| `test/ActionPins.ts:175`, `:181`, `:187`, `:189` | Replace each expected `false` with `true`            | Negative-case assertions fail                                                     |
| `test/ActionPins.ts:189`                         | Delete local-action assertion                        | Misclassified-local-action fixture test fails                                     |
| `test/ActionPins.ts:201`                         | Negate action filter                                 | Mixed-reference scan fixtures fail                                                |
| `test/ActionPins.ts:204`                         | Negate offender condition                            | Node20/node24 offender expectations fail                                          |
| `test/ActionPins.ts:205`                         | Delete offender push                                 | Node20 offender expectations fail                                                 |
| `test/ActionPins.ts:209`                         | Return `undefined`                                   | Empty-list result assertion fails                                                 |
| `test/ActionPins.ts:221`, `:222`, `:225`, `:226` | Delete each expected object property                 | Mixed-reference or empty-workflow result assertion fails                          |
| `test/ActionPins.ts:232`                         | Delete missing-workflow assertion                    | Empty-directory fixture test fails on the wrong error message                     |
| `test/ActionPins.ts:236`                         | Delete document push                                 | Real-workflow vacuous-scan assertion fails                                        |
| `test/ActionPinsScan.ts:14`                      | Delete assertion; delete expected `checked` property | Incorrect-empty-count fixture test; empty-list result assertion fail respectively |
| `test/ActionPinsScan.ts:21`, `:22`               | Delete each expected object property                 | Cross-file aggregation assertion fails                                            |
| `test/ActionPinsScan.ts:31`, `:32`               | Delete each expected object property                 | Job-level reference assertion fails                                               |

No line is exempted. All listed lines are reachable and tested.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
