# PR Summary — Issue #104

## Summary

Closes #104. `.github/workflows/spellcheck.yaml` pinned
`streetsidesoftware/cspell-action` to v6.11.1 (`e464ae97…`), which declares
`using: node20`, a runtime GitHub removed on 2026-09-16. It is now pinned to
`streetsidesoftware/cspell-action@6f3c77c1406bc930f944ba97e9801a22e42caf58 # v9.1.0`
(`using: node24`). The SHA pin and trailing version comment are kept, and the
`files` and `config` inputs are unchanged.

The node20 guard in `test/ActionPins.ts` is extended from `actions/checkout`
only to a per-action map (`NODE20_ACTION_SHAS`) covering `actions/checkout` and
`streetsidesoftware/cspell-action`. `test/SpellcheckWorkflow.ts` also pins the
cspell step to a SHA, requires a `# vX.Y.Z` comment with major version 8 or
later, and checks the `files` and `config` inputs.

**Docs sweep** — grep: `cspell`, `spellcheck`, `node20`; section:
`CONTRIBUTING.md` (line 61, the spellcheck check "runs cspell with `en-GB`");
siblings: `actions/checkout` is the one existing guarded action, and the guard
list is now a map that names both; updated: none — the sentence read through
does not mention the action version or pin, so it is still true; `CHANGELOG.md`
only mentions the read-only token

## Test Plan

- Removed from `test/ActionPins.ts`:
  `assert(checked > 0, "no actions/checkout references found; scan is vacuous");`
  Required by: "You could also extend the node20 guard in" Replaced by:
  `assert(count > 0, \`no ${action} references found; scan is
  vacuous\`);`(the single counter became a per-action counter, so the vacuity check now runs for`actions/checkout`and for`streetsidesoftware/cspell-action`)
- Removed from `test/ActionPins.ts`:
  `assertEquals( offenders, [], "actions/checkout must be on a node24 release, e.g. v6.0.2", );`
  Required by: "You could also extend the node20 guard in" Replaced by:
  `assertEquals( offenders, [], "each guarded action must be on a node24 release, e.g. actions/checkout v6.0.2 or streetsidesoftware/cspell-action v9.1.0", );`
  (same check over a wider set of actions; only the failure message changed)

## Branch outcomes

**Branch outcomes:**

- `test/ActionPins.ts:57` — match (guarded action, same-action node20 SHA) —
  `test/ActionPins.ts::usesNode20Action flags the cspell-action v6.11.1 pin from issue #104`
  — `?? false` flipped to `?? true`, test went red
- `test/ActionPins.ts:57` — no match (node24 SHA, cross-action SHA, unguarded
  action, local ref) —
  `test/ActionPins.ts::usesNode20Action accepts node24 cspell-action and mismatched action/SHA pairs`
  — return forced to true, test went red
- `test/ActionPins.ts:62` — checkout-only gate (`usesNode20Checkout`) —
  `test/ActionPins.ts::usesNode20Checkout accepts node24 checkout and unrelated actions`
  — return forced to undefined, test went red
- `test/ActionPins.ts:205` — skip an unguarded action in the workflow scan —
  `test/ActionPins.ts::no workflow pins a guarded action to a node20 runtime release`
  — condition negated, test went red
- `test/ActionPins.ts:207` — offender collected when a guarded action uses a
  node20 SHA —
  `test/ActionPins.ts::no workflow pins a guarded action to a node20 runtime release`
  — condition negated, test went red
- `test/ActionPins.ts:215` — vacuous-scan failure when a guarded action has no
  references —
  `test/ActionPins.ts::no workflow pins a guarded action to a node20 runtime release`
  — exempt (untestable): the deleted statement is the only assertion of that
  loop; a deletion of an assertion cannot turn its own test red, and the sibling
  data mutants (the map entries on lines 31 and 39) were confirmed red
- `test/SpellcheckWorkflow.ts:47` — cspell step not SHA-pinned —
  `test/SpellcheckWorkflow.ts::spellcheck job runs cspell-action pinned to a commit SHA`
  — pin changed to the tag `@v9`, test went red
- `test/SpellcheckWorkflow.ts:54` — version comment absent —
  `test/SpellcheckWorkflow.ts::spellcheck cspell-action version comment names major version 8 or later`
  — comment removed, test went red
- `test/SpellcheckWorkflow.ts:59` — major version below 8 (node20 release) —
  `test/SpellcheckWorkflow.ts::spellcheck cspell-action version comment names major version 8 or later`
  — comment changed to `v6.11.1`, test went red

## Mutation check

The 21 reported mutants are all in the test files themselves
(`test/ActionPins.ts`, `test/SpellcheckWorkflow.ts`). No other test imports
those modules, so the harness had nothing to run against them. I applied each
mutation by hand and ran the file's own tests:

- Went red: `test/ActionPins.ts:31`, `:39` (deleted map entries), `:57` (both
  mutants), `:62`, `:172`, `:179`, `:186`, `:188` (`false` -> `true`), `:197`,
  `:205`, `:206`, `:207`.
- Survived only where the mutant deletes the sole assertion statement of a test,
  which cannot make that test fail. Each of these is recorded as exempt:
  - `test/ActionPins.ts:151` exempt (untestable): the deleted `assert` is the
    only statement in that loop test, and the cspell pin is covered separately
    by the literal test on line 156. No other test imports the module.
  - `test/ActionPins.ts:188` exempt (untestable): the deleted `assertEquals`
    call is one of several; the neighbouring `assertEquals` calls in the same
    test and the red `false` -> `true` flips cover the behaviour.
  - `test/ActionPins.ts:215` exempt (untestable): the deleted
    `assert(count > 0, …)` is the vacuity check itself.
  - `test/SpellcheckWorkflow.ts:46`, `:47`, `:67`, `:68`, `:69` exempt
    (untestable): each is a deleted assertion statement inside a test of the
    workflow file; the module is itself the test and no other test imports it,
    so a deleted assertion cannot make a test go red. The checked behaviour is
    covered by the other tests in the same file, with the workflow edits above
    confirmed red.

## Test commands

- `deno test --allow-all test/ActionPins.ts test/SpellcheckWorkflow.ts` passes.
