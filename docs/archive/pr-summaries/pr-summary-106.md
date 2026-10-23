# PR Summary — Issue #106

## Summary

Closes #106. `.github/workflows/github-release.yml` pinned
`softprops/action-gh-release` to `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`
(v2.6.2), which declares `using: node20`, a runtime GitHub removed on
2026-09-16. It is now pinned to `efb35369e0ad2afab669f228072c1b0d510eae64`
(v3.0.3), keeping the SHA pin and the trailing version comment. The `with:`
options are unchanged. The node20 guard in `test/ActionPins.ts` now also covers
this action; its logic lives in the new `tools/GhReleasePins.ts`, which the test
imports.

- [x] Re-pin `github-release.yml` to v3.0.3
- [x] Guard test for node20 `softprops/action-gh-release` pins
- [x] Positive, negative and fixture-based tests in `test/ActionPins.ts`
- [x] Guard logic extracted to `tools/GhReleasePins.ts` so it is imported by a
      test
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
- Red on base: the real-workflow test fails with the v2.6.2 SHA in place (the
  `github-release.yml:40` entry under Branch outcomes). Green at head:
  `deno test --allow-read test/ActionPins.ts` passes 14 tests, 0 failures.
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

Tests added (14 in the file, 8 new), all in `test/ActionPins.ts`:

- "usesNode20GhRelease flags the node20 v2.6.2 pin" (positive).
- "usesNode20GhRelease accepts node24 and unrelated actions" (negative: v3.0.3,
  a checkout SHA, another action on the v2.6.2 SHA).
- "scanGhReleaseFiles reports node20 pins and counts only gh-release refs"
  (fixtures: offender collection, aggregation, the `checked` counter).
- "ghReleaseScanProblems fails a vacuous scan and lists node20 pins".
- "usesRefs collects job-level and step-level uses and ignores non-strings".
- "scanGhRelease counts job-level refs and tags offenders with the file".
- "readWorkflowTexts maps each file path to its text".
- "no workflow pins softprops/action-gh-release to node20" scans the real
  workflows through `ghReleaseScanProblems`.

Callers and siblings checked: `usesNode20GhRelease`, `scanGhRelease`,
`scanGhReleaseFiles`, `ghReleaseScanProblems`, `readWorkflowTexts` and
`NODE20_GH_RELEASE_SHAS` are new, in `tools/GhReleasePins.ts`, with callers only
in `test/ActionPins.ts`. `usesRefs` moved there unchanged from
`test/ActionPins.ts`, which still uses it for the checkout guard.
`test/GitleaksWorkflow.ts` reads `gitleaks.yml` and was not edited.
`test/ReleaseSbom.ts` reads `.github/workflows/github-release.yml`, the same
file this branch re-pins; it was not edited and still passes, because it only
looks up the `softprops/action-gh-release@` step by prefix (line 109), not by
SHA. This is a twinned rule with the `actions/checkout` guard
(`usesNode20Checkout`); that guard is unchanged and has its own tests.

**Branch outcomes:**

- `tools/GhReleasePins.ts:22` — absent (a ref to any other action is not
  flagged) —
  `test/ActionPins.ts::usesNode20GhRelease accepts node24 and unrelated actions`
  — flipped `===` to `!==`, 5 tests red
- `tools/GhReleasePins.ts:23` — success (the v2.6.2 SHA is flagged) / absent (a
  node24 SHA is not) —
  `test/ActionPins.ts::usesNode20GhRelease flags the node20 v2.6.2 pin` — forced
  the SHA lookup to `false`, 4 tests red
- `tools/GhReleasePins.ts:50` — absent (non gh-release refs are skipped, not
  counted) —
  `test/ActionPins.ts::scanGhRelease counts job-level refs and tags offenders with the file`
  — forced the skip condition to `false`, 2 tests red
- `tools/GhReleasePins.ts:53` — error (a node20 pin is recorded as an offender)
  —
  `test/ActionPins.ts::scanGhReleaseFiles reports node20 pins and counts only gh-release refs`
  — removed the `offenders.push`, 3 tests red
- `tools/GhReleasePins.ts:79` — error (no gh-release reference found is reported
  as vacuous) —
  `test/ActionPins.ts::ghReleaseScanProblems fails a vacuous scan and lists node20 pins`
  — forced the condition to `false`, test went red
- `tools/GhReleasePins.ts:79` — success (a scan that found a reference adds no
  vacuity problem) —
  `test/ActionPins.ts::ghReleaseScanProblems fails a vacuous scan and lists node20 pins`
  — forced the condition to `true`, the node24 fixture returned a problem and
  the test went red
- `tools/GhReleasePins.ts:93` — success (each workflow file is loaded into the
  map) — `test/ActionPins.ts::readWorkflowTexts maps each file path to its text`
  — dropped the `texts.set`, 2 tests red
- `.github/workflows/github-release.yml:40` — success (the release workflow pins
  a node24 gh-release SHA) —
  `test/ActionPins.ts::no workflow pins softprops/action-gh-release to node20` —
  restored the v2.6.2 SHA, test went red

<!-- vibe-branch-outcomes -->

**Mutation check:** the earlier survivors were all in `test/ActionPins.ts`,
which is itself a test entry point that nothing imports, so the gate could not
map a test to it. The guard logic now lives in `tools/GhReleasePins.ts`, which
`test/ActionPins.ts` imports (the same layout as `tools/Sbom.ts` and
`test/ReleaseSbom.ts`), and every function there is covered by a named test
above. The mutations were red-checked by hand against the new file (each break
applied, test run, then restored; final run 14 passed). No line is recorded as
exempt.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
