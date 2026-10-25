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
  ``assert(count > 0, `no ${action} references found; scan is vacuous`);`` (the
  single counter became a per-action counter, so the vacuity check now runs for
  `actions/checkout` and for `streetsidesoftware/cspell-action`)
- Removed from `test/ActionPins.ts`:
  `assertEquals( offenders, [], "actions/checkout must be on a node24 release, e.g. v6.0.2", );`
  Required by: "You could also extend the node20 guard in" Replaced by:
  `assertEquals( offenders, [], "each guarded action must be on a node24 release, e.g. actions/checkout v6.0.2 or streetsidesoftware/cspell-action v9.1.0", );`
  (same check over a wider set of actions; only the failure message changed)

## Branch outcomes

The verifier findings reproduced before this correction:

- Changing `usesNode20Action`'s `?? false` to `?? true` left the positive
  `usesNode20Action flags the cspell-action v6.11.1 pin from issue #104` test
  passing. That known SHA matches before reaching the fallback. The test that
  actually fails is
  `usesNode20Action accepts node24 cspell-action and mismatched
  action/SHA pairs`,
  whose unguarded action and local reference reach the fallback.
- Replacing the workflow scanner's `if (usesNode20Action(uses))` with
  `if (false)` left all 33 original focused tests passing. The added regression
  suite now supplies workflows containing old cspell and checkout pins; both
  offender probes fail when collection is disabled.

`test/WorkflowGuardRegression_test.ts::workflow guards reject invalid fixtures and
faulty helpers`
runs 17 isolated probes. This discoverable Deno test entry also imports the
three guard modules, registering their tests and exposing the dependency
relationship to test runners. Each probe copies the guard modules and Deno
configuration to a temporary directory, supplies a synthetic workflow or known
faulty helper, and requires the named guard test to fail. This checks the
failure behaviour of assertions inside test modules, including assertions that
merely importing those modules cannot protect. Copies use cached dependencies;
repository workflows and source files are untouched by these probes.

The checkout compatibility test now explicitly rejects a node20 cspell pin.
Spellcheck fixtures include a `run` step without `uses`, exercising the type
check. Input checks distinguish missing steps, missing input blocks, changed
`files`, and changed `config`; negative tests require the corresponding
assertion message, so a broken fixture cannot pass by throwing an unrelated
error.

## Mutation check

All 40 listed mutations were applied separately and made the focused suite fail
at runtime. Each edit was restored before the next mutation. The additional
verifier mutation that forces offender collection off also failed: 41/41 killed.
No `exempt (untestable)` entries are needed.

The line numbers below identify the gate's original snapshot, before this
correction added tests. Grouped entries were mutated separately. Test names are
abbreviated in the table as follows:

- **checkout-positive / checkout-negative** —
  `test/ActionPins.ts::usesNode20Checkout
  flags each known node20 checkout SHA`
  / `usesNode20Checkout accepts node24
  checkout and unrelated actions`.
- **action-negative** —
  `test/ActionPins.ts::usesNode20Action accepts node24
  cspell-action and mismatched action/SHA pairs`.
- **scan** —
  `test/ActionPins.ts::no workflow pins a guarded action to a node20
  runtime release`.
- **pin-negative / inputs-negative** —
  `test/SpellcheckWorkflow.ts::cspell pin check
  rejects a missing step and tag or branch refs`
  / `cspell inputs check rejects a
  missing step and changed inputs`.
- **R** — a named step of
  `test/WorkflowGuardRegression_test.ts::workflow guards reject
  invalid fixtures and faulty helpers`.

| Original location                     | Mutation replayed                             | Test that failed                                                                    |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `test/ActionPins.ts:31,39`            | Delete either action-name array element (2)   | `WorkflowGuardSuite.ts::guarded actions include checkout and cspell-action`         |
| `test/ActionPins.ts:57`               | Fallback false to true                        | action-negative                                                                     |
| `test/ActionPins.ts:57`               | Return undefined                              | checkout-positive                                                                   |
| `test/ActionPins.ts:62`               | Return undefined                              | checkout-positive                                                                   |
| `test/ActionPins.ts:62`               | Drop checkout-name operand                    | checkout-negative (old cspell fixture)                                              |
| `test/ActionPins.ts:62`               | Drop runtime operand                          | checkout-negative (node24 checkout)                                                 |
| `test/ActionPins.ts:151`              | Delete assertion                              | R: known-node20 test rejects a helper that misses every SHA                         |
| `test/ActionPins.ts:172,179,186,188`  | Expected false to true (4)                    | action-negative                                                                     |
| `test/ActionPins.ts:188`              | Delete local-ref assertion                    | R: acceptance test rejects a false positive for ./.github/actions/local             |
| `test/ActionPins.ts:197`              | Delete action from counter entry              | scan                                                                                |
| `test/ActionPins.ts:205`              | Negate skip condition                         | scan                                                                                |
| `test/ActionPins.ts:206`              | Delete counter increment                      | scan                                                                                |
| `test/ActionPins.ts:207`              | Negate offender condition                     | scan                                                                                |
| `test/ActionPins.ts:215`              | Delete vacuity assertion                      | R: scan rejects a workflow missing actions/checkout                                 |
| `test/SpellcheckWorkflow.ts:22`       | Drop string type check                        | pin-negative                                                                        |
| `test/SpellcheckWorkflow.ts:23`       | Drop cspell-name predicate                    | `spellcheck job runs cspell-action pinned to a commit SHA`                          |
| `test/SpellcheckWorkflow.ts:47,48`    | Delete step or SHA assertion (2)              | pin-negative                                                                        |
| `test/SpellcheckWorkflow.ts:54,55,56` | Delete step, files, or config assertion (3)   | inputs-negative                                                                     |
| `test/SpellcheckWorkflow.ts:65`       | Negate fixture ternary                        | pin-negative                                                                        |
| `test/SpellcheckWorkflow.ts:74,75`    | Delete files or config fixture property (2)   | inputs-negative                                                                     |
| `test/SpellcheckWorkflow.ts:79`       | Delete workflow pin check                     | R: workflow pin test rejects a tag                                                  |
| `test/SpellcheckWorkflow.ts:95`       | Delete version-comment assertion              | R: workflow version test rejects a missing comment                                  |
| `test/SpellcheckWorkflow.ts:114`      | Delete workflow inputs check                  | R: workflow inputs test rejects changed files                                       |
| `test/SpellcheckWorkflow.ts:126`      | Delete uses property or make it shorthand (2) | inputs-negative                                                                     |
| `test/SpellcheckWorkflow.ts:127`      | Delete with property                          | inputs-negative (missing input block differs from changed files)                    |
| `test/SpellcheckWorkflow.ts:134`      | Delete uses property or make it shorthand (2) | inputs-negative                                                                     |
| `test/SpellcheckWorkflow.ts:135`      | Delete with property                          | inputs-negative                                                                     |
| `test/SpellcheckWorkflow.ts:140`      | Delete final uses property                    | inputs-negative                                                                     |
| `test/WorkflowGuardSuite.ts:20`       | Delete pin assertion                          | R: importing suite rejects a faulty isPinned                                        |
| `test/WorkflowGuardSuite.ts:21`       | Delete runtime assertion                      | R: importing suite rejects a faulty usesNode20Action                                |
| `test/ActionPins.ts:207` (verifier)   | Force offender condition false                | R: scan collects a node20 cspell offender; scan collects a node20 checkout offender |

## Test commands

- `deno test --allow-all test/ActionPins.ts test/SpellcheckWorkflow.ts test/WorkflowGuardSuite.ts test/WorkflowGuardRegression_test.ts`
  passes (51 tests, 17 steps).
- The mutation replay uses the same four modules with `--no-check`, one edit at
  a time, to require runtime test failures rather than type errors.
- `bash quality.sh` passes (164 tests, 17 steps).
- `deno lint test/ActionPins.ts test/SpellcheckWorkflow.ts test/WorkflowGuardSuite.ts test/WorkflowGuardRegression_test.ts`
  and `git diff --check` pass.
