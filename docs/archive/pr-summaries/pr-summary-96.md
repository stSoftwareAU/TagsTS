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
- **The test uses a RegExp-free backtracking glob matcher copied from
  `test/GitleaksWorkflow.ts`.** It is a stand-in for GitHub semantics, checked
  against the cases in GitHub's documented filter-pattern cheat sheet:
  `milestone/foo` matches `milestone/*`, a `Develop`-only filter does not match
  it, and `milestone/a/b` does not match `milestone/*`, because `*` does not
  match `/`. The source is GitHub Docs, "Workflow syntax for GitHub Actions",
  filter pattern cheat sheet.

### Undiscoverable Facts

- GitHub's filter semantics are as set out above: `*` does not match `/`.
- No action SHAs were added or changed.

## Evidence

- `timeout 1200 ./quality.sh < /dev/null`: `ok | 124 passed | 0 failed`.
- **Docs sweep**: grep for `dependency-review`, `milestone` and `branches:`;
  section: `README.md`; siblings: the `gitleaks.yml`, `semgrep.yml`,
  `markdown-lint.yml` and `shellcheck.yml` workflow filters. gitleaks already
  has `milestone/*`. semgrep and markdown-lint use `**`. shellcheck is handled
  by #94 / PR #108 and is not touched here. No doc names the dependency-review
  branch filter, so no doc change is needed.
- No existing assertion was removed or loosened.
- **Deno-native test:** the test uses `deno test` with `@std/assert` and
  `@std/yaml`, both already in `deno.json`. No Node tooling was added.
- **Related rules checked:** the workflow-behaviour-change rule (a positive and
  a negative test for each invariant); the twinned-rule rule (a copy of
  `matchesBranchFilter` exists in `test/GitleaksWorkflow.ts`, and the helper
  test pins its semantics; copies are not shared because each test file is
  self-contained); and the worker's milestone-branch-filters workflow check
  (that file is not in this repository, so it was not run here; the filter
  follows its documented intent). The rules were applied to this PR's own diff
  and found nothing.

## Test Plan

- **Red first and flips:** reverting to `["Develop"]` turned only
  `dependency-review workflow runs on PRs targeting Develop and milestone branches`
  red. Setting `branches` to `["**"]` turned only
  `dependency-review workflow does not run on unrelated branches` red, because
  `feature/foo` matched. Both were restored.
- **Tests:** the helper test pins the glob semantics. `milestone/foo` against
  `["Develop"]` is false, against `["milestone/*"]` is true, `milestone/a/b` is
  false, and `["*"]` is false.

<!-- vibe-branch-outcomes -->

- Outcome `milestone/*` entry (PRs targeting `milestone/<slug>` trigger the
  workflow) at `.github/workflows/dependency-review.yml:14`, covered by
  `dependency-review workflow runs on PRs targeting Develop and milestone branches`
  in `test/DependencyReviewWorkflow.ts`.
- Outcome filter excludes unrelated branches (no `**`/`*` catch-all) at
  `.github/workflows/dependency-review.yml:14`, covered by
  `dependency-review workflow does not run on unrelated branches` in
  `test/DependencyReviewWorkflow.ts`.

## Security Self-Check

- [x] No new permissions, secrets or action pins.
- [x] No input from outside the repo is parsed beyond the committed workflow
      file.
