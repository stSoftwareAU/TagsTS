# PR Summary — Issue #106

## Summary

Closes #106. `.github/workflows/github-release.yml` pinned
`softprops/action-gh-release` to `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`
(v2.6.2), which declares `using: node20`, a runtime GitHub removed on
2026-09-16. It is now pinned to `efb35369e0ad2afab669f228072c1b0d510eae64`
(v3.0.3), keeping the SHA pin and the trailing version comment. The `with:`
options are unchanged. A node20 guard for this action, beside the existing
`actions/checkout` and `actions/dependency-review-action` guards, lives in
`tools/GhReleasePins.ts` and is tested by the new `test/GhReleasePins.ts`.

- [x] Re-pin `github-release.yml` to v3.0.3
- [x] Guard for node20 `softprops/action-gh-release` pins in
      `tools/GhReleasePins.ts`
- [x] Positive, negative and fixture-based tests in `test/GhReleasePins.ts`
- [x] `test/GhReleasePinsScan.ts` imports `test/GhReleasePins.ts` (the layout
      `test/ActionPinsScan.ts` uses) and checks the workflow keeps a SHA pin
      with a v3 version comment
- [x] `usesRefs` moved from `test/ActionPins.ts` to the tools module; the
      checkout and dependency-review guards still use it by import
- [x] Branch merged with `origin/Develop` (one conflict, in
      `test/ActionPins.ts`)

## Spec

### Intent and Rationale

- Same finding as #72 and #105: a node20 action warns and later breaks the
  release step. The fix re-pins to the node24 release instead of suppressing it.

### Essential Design Decisions

- The guard is a denylist of known node20 SHAs (only v2.6.2 today), mirroring
  `NODE20_CHECKOUT_SHAS`, so a future node24 bump needs no test edit.
- The scan logic is in `tools/GhReleasePins.ts` and its tests in their own file,
  so `test/ActionPins.ts` carries almost no new lines after the merge with
  Develop's #105 guard.

### Undiscoverable Facts

- The repo's tests are `test/*.ts`, not `*_test.ts`; the mutation gate maps a
  test to a module only through an importing test file, which is why
  `test/GhReleasePinsScan.ts` exists.

## Evidence

- `gh api repos/softprops/action-gh-release/commits/v3.0.3 --jq .sha` returns
  `efb35369e0ad2afab669f228072c1b0d510eae64`.
- v3.0.3 was published 2026-08-30T00:30:08Z, outside the 24h quarantine
  (`minimumDependencyAge` P1D).
- `action.yml` at the new SHA declares `using: "node24"` (line 78, read through
  `gh api …/contents/action.yml?ref=<sha>`); at the old SHA it declares
  `using: "node20"`.
- The v3.0.0 release notes list only the Node 24 runtime move and dependency
  updates, with no input changes, so the `with:` options (`tag_name`, `name`,
  `files`, `generate_release_notes`, `fail_on_unmatched_files`) stay as they
  were.
- After the merge with `origin/Develop`:
  `deno test --allow-all test/GhReleasePins.ts test/GhReleasePinsScan.ts test/ActionPins.ts test/ActionPinsScan.ts`
  passes 41 tests, 0 failures.
- `deno.lock`: `deno.json` sets `lock: false`; no lockfile change, no new
  dependency.

**Docs sweep** — grep: `softprops`, `action-gh-release`, `node20`, `v2.6.2`,
`3bb12739`, `ActionPins` over `README.md`, `docs/` (excluding `docs/archive/`)
and every `*/README.md`; section: none — no manual documents the release action
pin; siblings: none — no existing set gained a member (the denylist
`NODE20_CHECKOUT_SHAS` is for a different action and is unchanged); updated:
none — no non-archive doc hit, so no sentence became false.

## Test Plan

No assertion was removed from an existing test. Against `origin/Develop`, the
only lines `git diff origin/Develop -- test/ActionPins.ts` removes are the local
`usesRefs` function, which moved unchanged to `tools/GhReleasePins.ts` and is
imported back; it is not an assertion. Required by: "Re-pin to a node24 release"
and the guard that "does not catch this".

Tests added, in `test/GhReleasePins.ts`:

- "usesNode20GhRelease flags the node20 v2.6.2 pin" (positive).
- "usesNode20GhRelease accepts node24 and unrelated actions" (negative: v3.0.3,
  a checkout SHA, another action on the v2.6.2 SHA).
- "scanGhReleaseFiles reports node20 pins and counts only gh-release refs".
- "ghReleaseScanProblems fails a vacuous scan and lists node20 pins".
- "usesRefs collects job-level and step-level uses and ignores non-strings".
- "scanGhRelease counts job-level refs and tags offenders with the file".
- "readWorkflowTexts maps each file path to its text".
- "no workflow pins softprops/action-gh-release to node20" scans the real
  workflows.

Added in `test/GhReleasePinsScan.ts`: "github-release.yml keeps the SHA pin with
a v3 version comment".

Callers and siblings checked: `usesNode20GhRelease`, `scanGhRelease`,
`scanGhReleaseFiles`, `ghReleaseScanProblems`, `readWorkflowTexts` and
`NODE20_GH_RELEASE_SHAS` are new, with callers only in `test/GhReleasePins.ts`.
`usesRefs` is now exported from `tools/GhReleasePins.ts`; its callers are
`scanGhRelease`, `test/ActionPins.ts` (checkout, dependency-review and pin
scans, unchanged behaviour, covered by `test/ActionPins.ts` and
`test/ActionPinsScan.ts`, which pass) and `test/GhReleasePins.ts`.
`test/ReleaseSbom.ts` reads `github-release.yml`, the file this branch re-pins;
it was not edited and still passes, because it looks up the
`softprops/action-gh-release@` step by prefix, not by SHA. This is a twinned
rule with the `actions/checkout` and `actions/dependency-review-action` guards;
both are unchanged and have their own tests.

Red-checks run after the merge on the head (each break applied, the four test
files run, then restored):

- `tools/GhReleasePins.ts:23` SHA lookup forced to `true` → red.
- `tools/GhReleasePins.ts:50` action filter forced off → red.
- `github-release.yml:40` restored to the v2.6.2 SHA → red.

The other outcomes below were red-checked earlier on the same code (the tools
file is unchanged since; only its module doc comment changed).

**Branch outcomes:**

- `tools/GhReleasePins.ts:22` — absent (a ref to any other action is not
  flagged) —
  `test/GhReleasePins.ts::usesNode20GhRelease accepts node24 and unrelated actions`
  — flipped `===` to `!==`, 5 tests red
- `tools/GhReleasePins.ts:23` — success (the v2.6.2 SHA is flagged) / absent (a
  node24 SHA is not) —
  `test/GhReleasePins.ts::usesNode20GhRelease flags the node20 v2.6.2 pin` —
  forced the SHA lookup to `true`, tests red
- `tools/GhReleasePins.ts:50` — absent (non gh-release refs are skipped, not
  counted) —
  `test/GhReleasePins.ts::scanGhRelease counts job-level refs and tags offenders with the file`
  — forced the skip condition off, tests red
- `tools/GhReleasePins.ts:53` — error (a node20 pin is recorded as an offender)
  —
  `test/GhReleasePins.ts::scanGhReleaseFiles reports node20 pins and counts only gh-release refs`
  — removed the `offenders.push`, 3 tests red
- `tools/GhReleasePins.ts:79` — error (no gh-release reference found is reported
  as vacuous) —
  `test/GhReleasePins.ts::ghReleaseScanProblems fails a vacuous scan and lists node20 pins`
  — forced the condition to `false`, test went red
- `tools/GhReleasePins.ts:79` — success (a scan that found a reference adds no
  vacuity problem) —
  `test/GhReleasePins.ts::ghReleaseScanProblems fails a vacuous scan and lists node20 pins`
  — forced the condition to `true`, the node24 fixture returned a problem and
  the test went red
- `tools/GhReleasePins.ts:93` — success (each workflow file is loaded into the
  map) —
  `test/GhReleasePins.ts::readWorkflowTexts maps each file path to its text` —
  dropped the `texts.set`, 2 tests red
- `.github/workflows/github-release.yml:40` — success (the release workflow pins
  a node24 gh-release SHA) —
  `test/GhReleasePins.ts::no workflow pins softprops/action-gh-release to node20`
  — restored the v2.6.2 SHA, test went red

<!-- vibe-branch-outcomes -->

**Mutation check:** earlier attempts reported survivors in `test/ActionPins.ts`
and `tools/GhReleasePins.ts` ("no test imports this module"). The guard now
lives in `tools/GhReleasePins.ts`, tested by `test/GhReleasePins.ts`, which
`test/GhReleasePinsScan.ts` imports so its own lines are exercised too (the
`test/ActionPinsScan.ts` layout). `test/ActionPins.ts` now adds only an import
and a comment, and removes a function. I could not run the worker's mutation
gate here, so the gate's verdict on this layout is not yet observed; no line is
recorded as exempt.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
