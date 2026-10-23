# PR Summary — Issue #106

## Summary

Closes #106. `.github/workflows/github-release.yml` pinned
`softprops/action-gh-release` to `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`
(v2.6.2), which declares `using: node20`, a runtime GitHub removed on
2026-09-16. It is now pinned to `efb35369e0ad2afab669f228072c1b0d510eae64`
(v3.0.3), keeping the SHA pin and the trailing version comment. The `with:`
options are unchanged. The node20 guard in `test/ActionPins.ts` now also covers
this action.

- [x] Re-pin `github-release.yml` to v3.0.3
- [x] Guard test for node20 `softprops/action-gh-release` pins
- [x] Positive, negative and fixture-based tests in `test/ActionPins.ts`
- [x] Red-checks done by hand, each restored

## Evidence

- `gh api repos/softprops/action-gh-release/commits/v3.0.3 --jq .sha` returns
  `efb35369e0ad2afab669f228072c1b0d510eae64`.
- v3.0.3 was published 2026-08-30T00:30:08Z, outside the 24h quarantine
  (`minimumDependencyAge` P1D).
- `action.yml` at the new SHA declares `using: "node24"`; at the old SHA it
  declares `using: "node20"`.
- The v3.0.0 release notes list only the Node 24 runtime move and dependency
  updates, with no input changes, so the `with:` options stay as they were.
- Red on base: the real-workflow test fails with the v2.6.2 SHA in place
  (red-check D below). Green at head:
  `deno test --allow-read test/ActionPins.ts` passes 11 tests, 0 failures.
  Without `--allow-read` three tests fail with `NotCapable`, a permissions
  artefact; `quality.sh` runs with `--allow-all`.
- `deno.lock`: `deno.json` sets `lock: false`; no lockfile change, no new
  dependency.

**Docs sweep** — grep: `softprops`, `action-gh-release`, `node20`, `v2.6.2`,
`3bb12739`, `ActionPins` over `README.md`, `docs/` (excluding `docs/archive/`)
and every `*/README.md`; section: none — no manual documents the release action
pin; siblings: none — no existing set gained a member (the denylist
`NODE20_CHECKOUT_SHAS` is for a different action and is unchanged); updated:
none — there were no hits in any non-archive doc, so no sentence became false.

## Test Plan

No assertion was removed from an existing test.
`git diff origin/Develop -- test/ActionPins.ts` removes one line, the header
comment `// runtime, which GitHub removed on 2026-09-16 (issue #72).`, reworded
to add the issue #106 sentence. Required by: "re-pin it to the node24 release
v3.0.3" and the guard "must also catch this action".

Tests added (11 in the file, 5 new):

- "usesNode20GhRelease flags the node20 v2.6.2 pin" (positive).
- "usesNode20GhRelease accepts node24 and unrelated actions" (negative: v3.0.3,
  a checkout SHA, another action on the v2.6.2 SHA).
- "scanGhReleaseFiles reports node20 pins and counts only gh-release refs"
  (fixtures: offender collection, aggregation, the `checked` counter).
- "ghReleaseScanProblems fails a vacuous scan and lists node20 pins".
- "no workflow pins softprops/action-gh-release to node20" scans the real
  workflows through `ghReleaseScanProblems`.

Red-checks (each break applied by hand, test run, then restored; final run 11
passed):

- A, `usesNode20GhRelease` action match inverted (`test/ActionPins.ts:48`): 4
  tests red.
- B, `checked === 0` forced to `false` (`test/ActionPins.ts:235`):
  "ghReleaseScanProblems fails a vacuous scan…" red.
- C, SHA lookup `NODE20_GH_RELEASE_SHAS.has(ref ?? "")` forced to `false`
  (`test/ActionPins.ts:49`): 3 tests red.
- D, workflow reverted to the v2.6.2 SHA: "no workflow pins
  softprops/action-gh-release to node20" red.
- E, `offenders.push` removed (`test/ActionPins.ts:209`): "scanGhReleaseFiles…"
  and "ghReleaseScanProblems…" red.

Callers and siblings checked: `usesNode20GhRelease`, `scanGhRelease`,
`scanGhReleaseFiles` and `ghReleaseScanProblems` are new, with callers only in
`test/ActionPins.ts`. The sibling workflow tests (`test/GitleaksWorkflow.ts`,
`test/ReleaseSbom.ts`) read other files and were not edited. This is a twinned
rule with the `actions/checkout` guard (`usesNode20Checkout`); that guard is
unchanged and has its own tests.

<!-- vibe-branch-outcomes -->

**Mutation check:** the gate reported survivors in `test/ActionPins.ts` as "no
test imports this module": the file is itself a test entry point
(`deno test
test/*.ts`) and nothing imports it. Harness search:
`grep -rn ActionPins test/` finds no importer; the other `test/*.ts` files cover
other workflows and cannot reach these functions. I extracted `scanGhRelease`,
`scanGhReleaseFiles` and `ghReleaseScanProblems` and covered them with fixture
tests, then red-checked by hand (A–E). Remaining survivors, if any, are exempt
(untestable): `test/ActionPins.ts:48`, `test/ActionPins.ts:49`,
`test/ActionPins.ts:209` and `test/ActionPins.ts:235` — the file is its own test
entry point, so the gate cannot map a test to it; the harness search above found
no importer, and the tests above exercise those lines.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
