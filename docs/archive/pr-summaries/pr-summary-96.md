# PR Summary — Issue #96

## Summary

Closes #96. `dependency-review.yml` triggered on `pull_request` with
`branches: ["Develop"]`, so PRs from milestone sub-issues (base
`milestone/<slug>`) never ran it. A vulnerable or disallowed-licence dependency
bump could merge into a milestone branch unchecked. The filter is now
`branches: ["Develop", "milestone/*"]` (line 14, with a one-line comment).

- [x] Change the `pull_request` branch filter in `dependency-review.yml`
- [x] Add `test/DependencyReviewWorkflow.ts`

## Spec

### Intent and Rationale

Close the same gap class as gitleaks (#65), semgrep (#67), markdown-lint (#66)
and shellcheck (#94), where a branch filter silently excluded milestone
sub-issue PRs.

### Essential Design Decisions

- **`*` does not match `/` in GitHub filter globs.** So `milestone/*` is listed
  explicitly. Milestone names have no nested slashes, so one level is enough.
- **`"Develop"` is kept.** PRs into `Develop` still run the workflow.
- **Both workflow tests import one RegExp-free backtracking glob matcher
  (`tools/BranchFilter.ts`).** `test/GitleaksWorkflow.ts` no longer carries a
  private copy, so the two tests cannot judge a branch differently. The path and
  content match `tools/BranchFilter.ts` in PR #108, so whichever PR merges
  second sees an identical add/add. It is a stand-in for GitHub semantics,
  checked against the cases in GitHub's documented filter-pattern cheat sheet:
  `milestone/foo` matches `milestone/*`, a `Develop`-only filter does not match
  it, and `milestone/a/b` does not match `milestone/*`, because `*` does not
  match `/`. The source is GitHub Docs, "Workflow syntax for GitHub Actions",
  filter pattern cheat sheet.

### Undiscoverable Facts

- GitHub's filter semantics are as set out above: `*` does not match `/`.
- No action SHAs were added or changed.

## Evidence

- `timeout 1200 ./quality.sh < /dev/null`: `ok | 124 passed | 0 failed`.
- **Docs sweep** — grep: `dependency-review`, `milestone/`, `branches:`,
  `BranchFilter`, `cspell`; section: none — no manual documents the
  dependency-review branch filter, the `tools/BranchFilter.ts` test helper, the
  `cspell.json` word list or the `deno.json` change (README.md, CONTRIBUTING.md
  and docs/ have no hit for those names); siblings: `gitleaks.yml`,
  `semgrep.yml`, `markdown-lint.yml`, `shellcheck.yml` branch filters —
  gitleaks already lists `milestone/*`, semgrep and markdown-lint use `**`,
  shellcheck is handled by #94 / PR #108; no doc lists them, so none needed
  updating; no hits
- No existing assertion was removed or loosened.
- **Deno-native test:** the test uses `deno test` with `@std/assert` and
  `@std/yaml`, both already in `deno.json`. No Node tooling was added.
- **Related rules checked:** the workflow-behaviour-change rule (a positive and
  a negative test for each invariant); the twinned-rule rule (the one copy of
  `matchesBranchFilter` that was in `test/GitleaksWorkflow.ts` moved to
  `tools/BranchFilter.ts`, and both `test/GitleaksWorkflow.ts` and
  `test/DependencyReviewWorkflow.ts` import it, so there is no second copy to
  drift; each file keeps its helper test); and the worker's
  milestone-branch-filters workflow check (that file is not in this repository,
  so it was not run here; the filter follows its documented intent). The rules
  were applied to this PR's own diff and found nothing.

## Test Plan

- **Red first and flips:** reverting to `["Develop"]` turned only
  `dependency-review workflow runs on PRs targeting Develop and milestone branches`
  red. Setting `branches` to `["**"]` turned only
  `dependency-review workflow does not run on unrelated branches` red, because
  `feature/foo` matched. Both were restored.
- **Tests:** the helper test pins the glob semantics. `milestone/foo` against
  `["Develop"]` is false, against `["milestone/*"]` is true, `milestone/a/b` is
  false, and `["*"]` is false.

**Branch outcomes:**

- `.github/workflows/dependency-review.yml:14` — `milestone/*` entry: PRs
  targeting `milestone/<slug>` trigger the workflow —
  `test/DependencyReviewWorkflow.ts::dependency-review workflow runs on PRs targeting Develop and milestone branches`
  — flipped branches to ["Develop"], test went red
- `.github/workflows/dependency-review.yml:14` — filter excludes unrelated
  branches (no catch-all) —
  `test/DependencyReviewWorkflow.ts::dependency-review workflow does not run on unrelated branches`
  — flipped branches to ["**"], test went red
- `tools/BranchFilter.ts:15` — absent (no patterns) — matches nothing —
  `test/DependencyReviewWorkflow.ts::dependency-review branch filter helper mirrors GitHub glob semantics`
  — flipped some to every, test went red
- `tools/BranchFilter.ts:24` — pattern consumed — match only if text consumed
  too —
  `test/DependencyReviewWorkflow.ts::dependency-review branch filter helper mirrors GitHub glob semantics`
  — inverted the end-of-pattern check, test went red
- `tools/BranchFilter.ts:31` — literal mismatch / text exhausted — no match —
  `test/DependencyReviewWorkflow.ts::dependency-review branch filter helper mirrors GitHub glob semantics`
  — changed && to ||, test went red
- `tools/BranchFilter.ts:36` — `**` crosses `/` —
  `test/DependencyReviewWorkflow.ts::dependency-review branch filter helper mirrors GitHub glob semantics`
  — inverted the `**` check, test went red
- `tools/BranchFilter.ts:49` — `*` stops at `/` —
  `test/DependencyReviewWorkflow.ts::dependency-review branch filter helper mirrors GitHub glob semantics`
  — removed the break, test went red
- `tools/BranchFilter.ts:51` — no match found — fail closed with false —
  `test/DependencyReviewWorkflow.ts::dependency-review branch filter helper mirrors GitHub glob semantics`
  — flipped false to true, test went red
- `tools/BranchFilter.ts:30` — exempt (untestable): the
  `textIndex < text.length` bound; `<=` is an equivalent mutant because
  `text[text.length]` is `undefined`, which never equals a pattern character, so
  no input can change the outcome. Searched the helper test in
  `test/DependencyReviewWorkflow.ts`.
- `tools/BranchFilter.ts:38` — exempt (untestable): the `patternIndex + 2` skip
  after `**`; `+ 1` is an equivalent mutant because the loop over `i` already
  tries every offset, so the same strings match. Searched the helper test in
  `test/DependencyReviewWorkflow.ts`.

## Security Self-Check

- [x] No new permissions, secrets or action pins.
- [x] No input from outside the repo is parsed beyond the committed workflow
      file.
