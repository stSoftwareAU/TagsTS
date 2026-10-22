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
      `scanDependencyReview` directly, so mutations of that module go red
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

- `deno test -A test/ActionPinsScan.ts`: 13 passed, 0 failed (the 10 tests of
  `test/ActionPins.ts` plus 3 new ones, since the import runs them too).

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

The gate listed six surviving mutants, all in `test/ActionPins.ts`, which no
test imported, so the gate had nothing to run against them. The new
`test/ActionPinsScan.ts` imports `scanDependencyReview` from that module (the
import also runs the module's own tests), so each mutant now makes a test fail.
Applied to a scratch copy and run with `deno test -A test/ActionPinsScan.ts`:

- `test/ActionPins.ts:209` replaced return value with undefined — red
  (`Cannot destructure property 'checked'`, plus the "returns an object" test).
- `test/ActionPins.ts:221` deleted `checked: 2` — red (type check and assertion
  failure in the fixture test).
- `test/ActionPins.ts:222` deleted `offenders` — red (same).
- `test/ActionPins.ts:225` deleted `checked: 0` — red (same).
- `test/ActionPins.ts:226` deleted `offenders: []` — red (same).
- `test/ActionPins.ts:236` deleted `docs.push(...)` — red ("scan is vacuous").

No line is exempted. The earlier `exempt (untestable)` entries for lines 50,
175, 181, 187, 189, 201, 204, 205 and 232 are withdrawn: they were reachable the
same way, and the file now runs under an importing test.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
