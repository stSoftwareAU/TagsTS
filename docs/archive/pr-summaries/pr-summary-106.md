# PR Summary — Issue #106

## Summary

Closes #106. `.github/workflows/github-release.yml` pinned
`softprops/action-gh-release` to `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`
(v2.6.2), which declares `using: node20`, a runtime GitHub removed on
2026-09-16. It is now pinned to `efb35369e0ad2afab669f228072c1b0d510eae64`
(v3.0.3). The `with:` options are unchanged.

- [x] Guard test for node20 `softprops/action-gh-release` pins
- [x] Re-pin `github-release.yml` to v3.0.3
- [x] Positive, negative and fixture-based tests in `test/ActionPins.ts`
- [x] Mutation checks red, then restored

## Evidence

- Red on base: "no workflow pins softprops/action-gh-release to node20" lists
  `github-release.yml` with `(v2.6.2)`. Re-pinning to the old SHA after the fix
  turns the same test red again.
- Green at head: `deno test test/ActionPins.ts` passes 10 tests with 0 failures.

**Docs sweep** — grep: `softprops`, `action-gh-release`, `node20`, `v2.6.2`,
`3bb12739`, `ActionPins` over `README.md`, `docs/` (excluding `docs/archive/`)
and every `*/README.md`; section: none — no manual documents the release action
pin; siblings: none — no existing set gained a member (the denylist
`NODE20_CHECKOUT_SHAS` is for a different action and is unchanged); updated:
none — there were no hits in any non-archive doc, so no sentence became false.

## Test Plan

No assertion was removed from an existing test. The only removed line in
`test/ActionPins.ts` is the header comment line
`// runtime, which GitHub removed on 2026-09-16 (issue #72).`, which was
reworded to add the issue #106 sentence.

- `test/ActionPins.ts` → "usesNode20GhRelease flags the node20 v2.6.2 pin"
  (positive).
- `test/ActionPins.ts` → "usesNode20GhRelease accepts node24 and unrelated
  actions" (negative: v3.0.3, a checkout SHA, another action on the v2.6.2 SHA).
- `test/ActionPins.ts` → "scanGhReleaseFiles reports node20 pins and counts only
  gh-release refs" uses fixture workflows to pin down offender collection,
  per-file aggregation and the checked counter.
- `test/ActionPins.ts` → "no workflow pins softprops/action-gh-release to
  node20" scans the real workflows and asserts `checked > 0`.

**Branch outcomes:**
- `test/ActionPins.ts:46` `usesNode20GhRelease` — false for another action, true
  for a node20 SHA, false for a node24 SHA —
  `test/ActionPins.ts::usesNode20GhRelease flags the node20 v2.6.2 pin` and
  `test/ActionPins.ts::usesNode20GhRelease accepts node24 and unrelated actions`
  — flipped (action match inverted; SHA lookup replaced by `false`), tests went
  red
- `test/ActionPins.ts:204` `scanGhRelease` skips non-gh-release refs —
  `test/ActionPins.ts::scanGhReleaseFiles reports node20 pins and counts only gh-release refs`
  — flipped the filter, test went red
- `test/ActionPins.ts:207` `scanGhRelease` records an offender for a node20 pin
  and none for node24 — same test — deleted the push, and negated the condition;
  both went red
- `test/ActionPins.ts:216` `scanGhReleaseFiles` aggregation of `checked` and
  `offenders` — same test — removed each aggregation line, test went red
- `.github/workflows/github-release.yml:40` pin — `test/ActionPins.ts::no workflow pins softprops/action-gh-release to node20`
  — flipped back to the v2.6.2 SHA, test went red
- `test/ActionPins.ts:268` vacuous-scan guard `assert(checked > 0, …)` in the
  real-workflow test — exempt (untestable): the guard only fires when no workflow
  references the action, which cannot be staged without deleting the release
  workflow; the existing tests of the scan (`scanGhReleaseFiles reports node20
  pins…`, which asserts `checked: 0` for an empty workflow) cover the counter.

**Mutation check:** the gate reported 8 survivors in `test/ActionPins.ts`, all
"no test imports this module". The module is itself a test file that `deno test
test/*.ts` runs directly and no other test imports it, so the gate could not
map a test to it. I applied the mutations by hand in a scratch copy and ran the
file; the ones that survived exposed real gaps, which I fixed by extracting
`scanGhRelease` and `scanGhReleaseFiles` and adding fixture tests. Every
mutation of lines the tests can reach now goes red, except:

- `test/ActionPins.ts:268` exempt (untestable): the vacuity guard, as above.
- `test/ActionPins.ts` redundant `assert(files.length > 0)` in the new test was
  removed because `checked > 0` already covers an empty scan.
- Any remaining mutation of an assertion line in this file is reported as
  "no test imports this module" because the file is its own test entry point;
  exempt (untestable): no other test imports it and none can without running its
  tests twice.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
