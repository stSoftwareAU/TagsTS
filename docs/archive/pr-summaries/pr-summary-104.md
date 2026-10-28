## Summary

Re-pins `streetsidesoftware/cspell-action` in `.github/workflows/spellcheck.yaml` from v6.11.1 (`e464ae97…`, `using: "node20"`) to v9.2.0 (`ce1816e4ce36532956ac6e983737392774b6e169`, `using: 'node24'`), keeping the SHA pin and trailing version comment, and adds a node20 guard for this action to `test/ActionPins.ts`. Closes #104.

Version bump: `deno.json` version is untouched by this change; the merged commit records the final version.

## Spec

### Intent and Rationale

- The node20 Actions runtime is withdrawn, so the spellcheck job would fail on every PR. Same fault as #72 and #105, which the existing guards do not cover for this action.

### Essential Design Decisions

- Pinned v9.2.0, not the issue's v9.1.0: v9.2.0 is the latest release (published 2026-10-14, outside the 24h quarantine) and also declares `using: 'node24'`. The issue called v9.1.0 "latest", which is stale.
- The guard mirrors the existing dependency-review guard (a SHA→tag map, `usesNode20Cspell`, `scanCspell`) rather than a generic framework, to stay in the established pattern.

### Undiscoverable Facts

- Inputs used by the workflow (`files`, `config`) are present in v9.2.0's `action.yaml` with unchanged defaults compared with v6.11.1 (checked with `gh api .../contents/action.yaml?ref=<tag>`).

## Evidence

Backend/CI change, no UI. Observed: `gh api repos/streetsidesoftware/cspell-action/commits/v9.2.0 --jq .sha` → `ce1816e4…`; `action.yaml` at v9.2.0 has `using: 'node24'`, at v6.11.1 `using: "node20"`.

## Test Plan

- Added in `test/ActionPins.ts`: `usesNode20Cspell flags the known node20 SHA`, `usesNode20Cspell accepts node24 v9.2.0 and unrelated actions`, `scanCspell lists a node20 pin and counts every reference`, `no workflow pins streetsidesoftware/cspell-action to a node20 runtime release`. No existing assertions were removed.
- Red check: restoring the old pin in the workflow makes `no workflow pins streetsidesoftware/cspell-action to a node20 runtime release` fail (13 passed, 1 failed); with the new pin all pass.
- `deno test --allow-all test/ActionPins.ts test/SpellcheckWorkflow.ts`: 16 passed, 0 failed.
- Twinned rules: the checkout, dependency-review and gh-release node20 guards are siblings; none was changed.
