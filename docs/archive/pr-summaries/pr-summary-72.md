# PR Summary — Issue #72

## Summary

Closes #72. Eight workflows pinned `actions/checkout` to a v4.x release that
runs on the deprecated `node20` Actions runtime. Each one is now re-pinned to
`actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2`, which runs
on `node24`. Every `with:` option is unchanged.

- [x] Failing guard test for node20 checkout pins (red on base, eight offenders)
- [x] Re-pin `actionlint.yml`, `dependency-review.yml`, `github-release.yml`,
      `gitleaks.yml`, `publish.yml`, `semgrep.yml`, `shellcheck.yml` and
      `spellcheck.yaml` to v6.0.2
- [x] Extend the workflow validator (`test/ActionPins.ts`) with positive and
      negative cases
- [x] Mutation checks red, then restored
- [x] `./quality.sh` green

## Spec

### Intent and Rationale

- Finding `BP-DEPRECATED-RUNTIME-actions-checkout`: GitHub has deprecated the
  `node20` runtime, so these steps will warn and later break.
- The fix re-pins to the latest release instead of suppressing the finding.
  v6.0.2 is already the pin in `quality.yml` and `update-package-version.yml`,
  so all checkout pins in the repo now share one SHA, apart from
  `markdown-lint.yml`.

### Essential Design Decisions and Undiscoverable Facts

- I confirmed the tag-to-SHA mapping with
  `gh api repos/actions/checkout/commits/v6.0.2 --jq .sha`, which returned
  `de0fac2e4500dabe0009e67214ff5f5447ce83dd`. The runtimes come from
  `gh api repos/actions/checkout/contents/action.yml?ref=<tag>`: `using: node20`
  at v4.4.0 and `using: node24` at v6.0.2.
- The repo is not quite as the issue describes. `codeql.yml` does not exist.
  `actionlint.yml` also pinned v4.4.0, so it was re-pinned too, and the total is
  still eight.
- `markdown-lint.yml` is left on v5 (`93cb6efe…`). v5 already runs on `node24`,
  and `test/MarkdownLintWorkflow.ts` (issue #27) pins that SHA.
- `NODE20_CHECKOUT_SHAS` is a denylist of the three v4 SHAs found in this repo's
  history: v4.4.0, v4.3.1 and v4.2.2. It is not a single allowed SHA, so a
  future node24 bump does not need this test edited.
- Each file keeps its existing version-comment style. Five use a trailing
  `# v6.0.2`. `gitleaks.yml`, `semgrep.yml` and `shellcheck.yml` use a preceding
  `# actions/checkout@v6.0.2` line.

## Evidence

- Red on base: "no workflow pins actions/checkout to a node20 runtime release"
  failed and listed all eight files, for example
  `.github/workflows/publish.yml: actions/checkout@11d5960a… (v4.4.0)`.
- Green after the re-pin: `deno test -A test/` passed 88 tests with 0 failures,
  `actionlint` was clean, and `./quality.sh` passed 88 tests with 0 failures.

**Docs sweep** — grep: `node20`, `11d5960a`, `checkout@v4`, `actions/checkout`
over `README.md`, `*/README.md`, `docs/` (excluding `docs/archive/`) and source
comments; also re-ran the excluded-path words `.github` and `test`; section:
none — no manual documents the checkout pins. Remaining hits, all still true:

- `README.md:158` — still true because it describes `./quality.sh` running lint,
  type-check, format and tests, which this change does not alter.
- `README.md:164` — still true because the gate and the CI `Test` step still run
  `deno test --reporter=dot`; no test runner flags changed.
- `README.md:172` — still true because the dependency-update step in
  `quality.yml` is untouched; only checkout pins in other workflows changed.
- `README.md:173` — still true because it names `.github/workflows/quality.yml`
  for `deno outdated --update --latest`, which this change does not edit.
- `README.md:191` — still true because it names
  `.github/workflows/markdown-lint.yml` for the `markdownlint-cli2` npm pin, and
  that workflow is not edited here.
- `README.md:200` — still true because actionlint still runs over
  `.github/workflows/` via `actionlint.yml`; only its checkout SHA changed.
- `test/MarkdownLintWorkflow.ts:42` — still true because it labels SHA
  `34e11487…` as actions/checkout v4 (Node 20), which remains accurate.
- `test/MarkdownLintWorkflow.ts:57` — still true because `markdown-lint.yml` is
  deliberately left on actions/checkout v5 `93cb6efe…` (Node 24).
- `test/QualityWorkflow.ts:223` — still true because it explains why test writes
  are confined away from tracked files such as `.github/workflows/*`, unrelated
  to checkout pins.

- Related existing rules checked: the node20 deny check in
  `test/MarkdownLintWorkflow.ts` from issue #27. This change applies the same
  rule to every workflow, and I did not change that check. The repo-wide SHA-pin
  check in `test/ActionPins.ts` still passes.

## Test Plan

- `test/ActionPins.ts` → "usesNode20Checkout flags each known node20 checkout
  SHA" (positive). Every SHA in the denylist is flagged.
- `test/ActionPins.ts` → "usesNode20Checkout accepts node24 checkout and
  unrelated actions" (negative). Nothing is flagged for v6.0.2, for v5
  `93cb6efe…`, for a different action pinned to a node20 checkout SHA, or for a
  local action.
- `test/ActionPins.ts` → "no workflow pins actions/checkout to a node20 runtime
  release" parses every real workflow with `@std/yaml` and asserts there are no
  offenders. It also asserts `checked > 0`, so an empty scan cannot pass.

Branch outcomes:

- `test/ActionPins.ts:32` `usesNode20Checkout`:
  - **Action is not `actions/checkout`, so the result is false.** Covered by the
    negative helper test (`other/action@11d5960a…`). Mutation: I dropped the
    action match, and the negative test went red
    (`FAILED | 5 passed | 1
    failed`).
  - **Checkout pinned to a known node20 SHA, so the result is true.** Covered by
    the positive helper test. Mutation: I made the function always return
    `false`, and the positive test went red (`FAILED | 5 passed | 1 failed`).
  - **Checkout pinned to an unknown or node24 SHA, so the result is false.**
    Covered by the negative helper test and the real-workflow test.
- `test/ActionPins.ts:130` offender collection. Mutation: I put `publish.yml`
  back on v4.4.0, and the real-workflow test went red with that file listed.
- `test/ActionPins.ts:136` vacuous-scan guard: `checked > 0` fails if no
  checkout reference is found.
- I ran each mutation in a scratch copy, so the worktree was never modified.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
