# PR Summary — Issue #104

## Summary

Closes #104. `spellcheck.yaml` pinned `streetsidesoftware/cspell-action` to
v6.11.1 (`e464ae97…`), whose `action.yaml` declares `using: "node20"`, a runtime
GitHub removed on 2026-09-16. It is now pinned to
`streetsidesoftware/cspell-action@ce1816e4ce36532956ac6e983737392774b6e169 # v9.2.0`
(`using: 'node24'`). The `with:` inputs (`files`, `config`) are unchanged.

- [x] Re-pin `.github/workflows/spellcheck.yaml` to v9.2.0
- [x] Add a node20 denylist guard to `test/ActionPins.ts` (`NODE20_CSPELL_SHAS`,
      `usesNode20Cspell`, `scanCspell`) with positive, negative, fixture and
      real-workflow tests
- [x] Test `scanCspell` directly from `test/ActionPinsScan.ts`, which imports
      `test/ActionPins.ts`, so the worker's mutation gate sees a test importing
      the changed module

## Spec

### Intent and Rationale

- Same finding as #72 (`actions/checkout`) and #105
  (`actions/dependency-review-action`): a node20 action warns now and fails when
  the runtime is withdrawn, which would fail the spellcheck job on every PR. The
  fix re-pins to a node24 release rather than suppressing the warning.

### Essential Design Decisions

- Pinned v9.2.0, not the v9.1.0 the issue named: v9.2.0 is the latest release
  and also declares `node24`. The issue called v9.1.0 "the latest", but v9.2.0
  was published 2026-10-14. Only the bundled CSpell version differs (10.4.0).
- The guard is a SHA denylist (v6.11.1 and v7.2.1, the last node20 release),
  mirroring `NODE20_CHECKOUT_SHAS`, so a later node24 bump needs no test edit.
  It does not itself prove a new pin is node24; that was verified by reading
  `action.yaml` (below).
- The denylist test loops over `NODE20_CSPELL_SHAS.keys()` instead of asserting
  its size, so adding a SHA needs no test edit.

### Undiscoverable Facts

- The v9.2.0 CSpell 10.4.0 run could not be exercised here; the first PR
  spellcheck run after merge is the first real use. A newly flagged word would
  be added to `.github/workflows/cspell.json`.

## Evidence

Checked with `gh api` on 2026-10-27:

- `v9.2.0` resolves to `ce1816e4ce36532956ac6e983737392774b6e169` (a commit, not
  an annotated tag), committed 2026-10-14T16:57:49Z, published
  2026-10-14T16:58:03Z, 13 days ago, well outside the 24h quarantine
  (`minimumDependencyAge` is `P1D`).
- `action.yaml` at that SHA: `using: 'node24'`. At `e464ae97…`:
  `using: "node20"`. At `v7.2.1` (`76c6f6d5…`): `node20`; at `v8.0.0`: `node24`.
- Changelog: v7.0.0 bumps CSpell to 9.0.0, v8.0.0's only breaking change is "Use
  node24 runner", v9.0.0 bumps CSpell to 10.0.0; v9.1.0 and v9.2.0 are CSpell
  and dependency updates.
- Inputs: `diff` of `action.yaml` between v6.11.1 and v9.1.0 shows quote-style
  changes plus additions only (new inputs `report` and `summary`, new outputs,
  `main` file renamed). `files`, `config` and `incremental_files_only` keep the
  same names and defaults. I did not diff v9.2.0's file against v9.1.0's; its
  release notes list only a CSpell bump and dependency updates.

## Test Plan

- Added to `test/ActionPins.ts`: "usesNode20Cspell flags every known node20
  SHA", "usesNode20Cspell accepts node24 v9.2.0 and unrelated actions",
  "scanCspell lists a node20 pin and counts every reference", "no workflow pins
  streetsidesoftware/cspell-action to a node20 runtime release". Only the header
  comment of this file was edited; no existing assertion was removed.
- Added to `test/ActionPinsScan.ts`: five `scanCspell` tests (empty list,
  aggregation across files, job-level reference, same SHA under another action,
  v7.2.1 label). The import line gained `scanCspell`; no assertion was removed.
- Red-checks, run in a scratch copy of `test/` and `.github/` against
  `test/ActionPinsScan.ts`:
  - `usesNode20Cspell` action operand forced true → red (1 failed)
  - `usesNode20Cspell` SHA operand forced true → red (4 failed)
  - `scanCspell` `continue` on other actions removed → red (3 failed)
  - v7.2.1 entry removed from the denylist → red (1 failed)
  - workflow reverted to the v6.11.1 pin → red (real-workflow test)
- `deno test --allow-all test/ActionPinsScan.ts test/SpellcheckWorkflow.ts`: 25
  passed, 0 failed. `deno fmt` and `deno lint test/`: clean.
- `./quality.sh < /dev/null` on the final test and workflow files: exit 0, 159
  passed, 0 failed.

**Docs sweep** — grep: `node20`, `cspell-action`, `spellcheck` over `README.md`,
`CONTRIBUTING.md`, `SECURITY.md` and `docs/` (excluding `docs/archive/`);
section: none documents the action pin; siblings: the `actions/checkout` and
`actions/dependency-review-action` guards in `test/ActionPins.ts`, unchanged. No
hits, so no doc updated.
