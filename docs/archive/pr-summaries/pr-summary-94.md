# PR Summary — Issue #94

## Summary

Closes #94. `shellcheck.yml` limited its `pull_request` trigger to
`branches: ["*"]`. In GitHub Actions filter globs `*` does not match `/`, so a
PR based on `milestone/<slug>` never ran ShellCheck. The filter is now
`["*", "milestone/*"]`, the same fix PR #93 made to `gitleaks.yml`.

- [x] Change the `pull_request` filter in `.github/workflows/shellcheck.yml`
- [x] Pin the filter in `test/ShellCheckWorkflow.ts` with a positive and a
      negative assertion

## Spec

### Intent and Rationale

Every PR, including milestone sub-issue PRs, must be checked by ShellCheck.

### Essential Design Decisions

- **Explicit `milestone/*` entry**, because `*` stops at `/`.
- **The test parses the real workflow** and matches `Develop`, `main` and
  `milestone/issue-94-slug` against it with a glob matcher. The matcher has no
  `RegExp`. It lives in `tools/BranchFilter.ts` (moved out of the test file so
  `test/BranchFilter.ts` can import and pin it, and so the mutation check can
  reach it). It is checked against GitHub's documented semantics (`*/*` matches
  `milestone/foo`, and `*` does not).
- **The negative assertion** shows that a bare `["*"]` does not match
  `milestone/issue-94-slug`, so the fixture can fail on the wrong input.

## Evidence

- `timeout 1000 ./quality.sh < /dev/null`: `ok | 123 passed | 0 failed` before
  the matcher moved; at head,
  `deno test --allow-read test/BranchFilter.ts test/ShellCheckWorkflow.ts test/GitleaksWorkflow.ts`
  is `ok | 18 passed | 0 failed`. **Docs sweep** — grep: `milestone`,
  `shellcheck`, `branches`, `branch filter`; section: none — no manual documents
  `shellcheck.yml`'s trigger; the nearest, `README.md#workflow-lint`, describes
  the actionlint workflow, and I read it through: every sentence stays true;
  siblings: `gitleaks.yml` and `semgrep.yml` (the same filter family, #65 and
  #67), their workflows are not touched by this issue (only
  `test/GitleaksWorkflow.ts` changed, to import the shared matcher); no existing
  set gained a member; updated: none
- No existing assertion was removed or loosened.

## Test Plan

- **Red first:** with only `.github/workflows/shellcheck.yml` reverted to the
  base, the milestone test fails with the message
  `expected branch 'milestone/issue-94-slug' to match the pull_request filter`.
  The other four tests in that file pass. Restored afterwards.
- **Callers/fakes:** no fakes. The glob matcher is the exported module
  `tools/BranchFilter.ts`; its callers, all checked, are
  `test/ShellCheckWorkflow.ts`, `test/GitleaksWorkflow.ts` and
  `test/BranchFilter.ts`.
- **Twinned rules:** `test/GitleaksWorkflow.ts` used to keep an identical
  private copy of the matcher; it now imports `matchesBranchFilter` from
  `tools/BranchFilter.ts` and the private copy is deleted, so there is one
  matcher. Its helper-semantics test stays and now exercises the shared module.

**Branch outcomes:**

- `.github/workflows/shellcheck.yml:10` — the `"milestone/*"` filter entry is
  dropped, so a PR based on `milestone/<slug>` no longer triggers ShellCheck.
  Goes red in `test/ShellCheckWorkflow.ts` ("shellcheck workflow runs on PRs
  targeting Develop, main and milestone branches"); flip: dropped the entry, the
  test went red.
- `tools/BranchFilter.ts:15` — any listed pattern matching is enough. Goes red
  in `test/BranchFilter.ts` ("branch filter: any listed pattern may match");
  flip: `some` changed to `every`, the test went red.
- `tools/BranchFilter.ts:24` — the pattern is exhausted, so the text must be
  exhausted too. Goes red in `test/BranchFilter.ts` ("branch filter: literal
  patterns match exactly"); flip: inverted the condition, the test went red.
- `tools/BranchFilter.ts:25` — error outcome: text left over after the pattern
  ends. Goes red in `test/BranchFilter.ts` ("branch filter: literal patterns
  match exactly"); flip: returned `true`, the test went red.
- `tools/BranchFilter.ts:28` — literal character branch. Goes red in
  `test/BranchFilter.ts` ("branch filter: literal patterns match exactly");
  flip: inverted the condition, the test went red.
- `tools/BranchFilter.ts:30` — exempt (untestable): the
  `textIndex < text.length` bounds guard is redundant, because `text[textIndex]`
  is `undefined` past the end and never equals a pattern character, so no input
  can distinguish the two (searched `test/BranchFilter.ts`, which cannot stage a
  differing input).
- `tools/BranchFilter.ts:36` — the `**` branch crosses slashes. Goes red in
  `test/BranchFilter.ts` ("branch filter: a double star crosses slashes"); flip:
  inverted the condition, the test went red.
- `tools/BranchFilter.ts:38` — exempt (untestable): `patternIndex + 2` against
  `+ 1` is an equivalent mutant, because the `**` loop already tries every start
  position, so a following `*` cannot change the result (searched
  `test/BranchFilter.ts`, which cannot stage a differing input).
- `tools/BranchFilter.ts:45` — absent outcome: `*` at the end of the text. Goes
  red in `test/BranchFilter.ts` ("branch filter: a single star stops at a
  slash"); flip: changed `<=` to `<`, the test went red.
- `tools/BranchFilter.ts:49` — `*` stops at a slash. Goes red in
  `test/BranchFilter.ts` ("branch filter: a single star stops at a slash");
  flip: deleted the `break` and inverted it, the test went red.

## Mutation check

The matcher that was in `test/ShellCheckWorkflow.ts` (lines 23-76) moved to
`tools/BranchFilter.ts`, and `test/BranchFilter.ts` imports it and pins every
branch, so the mutants reported there are killed, except the two equivalent
mutants exempted in the Branch outcomes list (`tools/BranchFilter.ts:30` and
`:38`). Two reported lines are assertions inside a test body, and no other test
can import a test file without registering its tests:

- `test/ShellCheckWorkflow.ts:82` (was :148) exempt (untestable): this is the
  `Array.isArray` assertion inside the test body; deleting it only removes a
  diagnostic, because the next line would throw on a non-array anyway.
- `test/ShellCheckWorkflow.ts:99` (was :165) exempt (untestable): this is the
  expected value of the negative assertion inside the test body; a test file
  cannot be imported to test it without registering its tests twice.

## Security Self-Check

- [x] No new permissions, secrets or `${{ github.* }}` interpolation.
- [x] No new third-party actions. The existing SHA pins are unchanged.
