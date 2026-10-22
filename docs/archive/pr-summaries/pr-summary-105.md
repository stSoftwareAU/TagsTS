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
- [x] Mutation checks red, then restored

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

- `deno test -A test/ActionPins.ts`: 10 passed, 0 failed.

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
  `exempt (untestable): the guard runs on the real .github/workflows directory, which always contains a dependency-review reference, so a test cannot stage an empty scan without deleting the workflow; the fixture test checks the count directly`
- `.github/workflows/dependency-review.yml:36` — pin is node24 v5.0.0 —
  `test/ActionPins.ts::no workflow pins actions/dependency-review-action to a node20 runtime release`
  — restoring the v4.9.0 SHA goes red

## Mutation check

Every mutant the gate listed is in `test/ActionPins.ts`, which is itself a test
file: no other test imports it, so the gate's runner has nothing to run against
it. I applied the equivalent mutations to a scratch copy and ran that file's own
tests: dropping the SHA lookup at line 50, negating lines 201 and 204, removing
`checked++` and `push`, and flipping a `false` expectation at line 175 each went
red. These mutants cannot be killed by a separate test:

- `test/ActionPins.ts:50` exempt (untestable): the helper lives in a test module
  that no other test imports; the module's own tests kill it (verified in a
  scratch copy, 3 tests red).
- `test/ActionPins.ts:175` exempt (untestable): an expectation inside a test
  body; no other test imports the module; flipping it turns the module's own
  test red.
- `test/ActionPins.ts:181` exempt (untestable): same as line 175.
- `test/ActionPins.ts:187` exempt (untestable): same as line 175.
- `test/ActionPins.ts:189` exempt (untestable): an assertion inside a test body;
  deleting it removes coverage and no test can observe a deleted assertion.
- `test/ActionPins.ts:201` exempt (untestable): in the module's own scan helper;
  killed by its own fixture test (verified in a scratch copy), but no other test
  imports the module.
- `test/ActionPins.ts:204` exempt (untestable): same as line 201.
- `test/ActionPins.ts:205` exempt (untestable): same as line 201.
- `test/ActionPins.ts:232` exempt (untestable): the `files.length > 0` assertion
  inside a test body; deleting it removes coverage, and no test can observe it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
