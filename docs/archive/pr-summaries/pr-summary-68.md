# PR Summary — Issue #68: re-pin the stale Gitleaks action

## Summary

Closes #68.

`.github/workflows/gitleaks.yml` now pins `gitleaks/gitleaks-action` to
`e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e` (`v3.0.0`) instead of
`ff98106e4c7b2bc287b24eaf42907196329070c7` (`v2.3.9`). The version comment
above the step changes with it. This clears finding
`BP-GITLEAKS-ACTION-STALE-gitleaks`. A new test, `test/GitleaksWorkflow.ts`,
checks both the SHA and the comment.

## Spec

### Intent and Rationale

`v2.3.9` runs on Node 20. GitHub removed Node 20 from its hosted runners on
16 September 2026, so the old pin can no longer run there. `v3.0.0` only moves
the action to Node 24. Its inputs, outputs and behaviour are unchanged, so
`GITHUB_TOKEN` and `GITLEAKS_LICENSE` still apply as they are.

### Essential Design Decisions

- **The SHA was resolved in this run, not written from memory.** It comes from
  `gh api repos/gitleaks/gitleaks-action/commits/v3.0.0 --jq .sha`, and the
  `v3` and `v3.0.0` tags both point at it.
- **Supply-chain quarantine.** `v3.0.0` was published on 2026-05-30, well past
  the 24-hour floor.
- **The version comment is tested along with the SHA.** `actionPin()` reads the
  `# <action>@<tag>` line directly above the `uses:` line. If someone changes
  the SHA but not the comment, the test fails, which guards against
  `version-comment-drift`.
- **Out of scope.** The workflow's `pull_request.branches: ["*"]` filter is
  unchanged in this PR.
- **Human-only follow-up.** If Gitleaks is meant to be a required status check
  in the branch ruleset, a maintainer has to set that. The worker does not
  change rulesets.

### Undiscoverable Facts

- Self-hosted runners need runner version `>= v2.327.1` for Node 24. This repo
  uses `ubuntu-latest`, so this does not affect it.

## Evidence

- Red: with the new test and the old pin, `deno test -A
  test/GitleaksWorkflow.ts` gave `FAILED | 4 passed | 1 failed`. The diff
  showed `gitleaks/gitleaks-action@ff98106…` where `@e0c47f4…` was expected.
- Green: after the re-pin, the same command gave `ok | 5 passed | 0 failed`.
- `actionlint .github/workflows/gitleaks.yml`: exit 0.
- `./quality.sh < /dev/null`: `ok | 75 passed | 0 failed`, exit 0.
- Docs sweep: I searched README.md, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md
  and docs/ (excluding docs/archive/) for
  `gitleaks|v2\.3\.9|node ?20`, case-insensitive. Section: none. There were no
  hits, so no docs needed changing.

## Test Plan

New tests in `test/GitleaksWorkflow.ts`:

- `gitleaks workflow pins gitleaks-action to the expected release`: this
  failed on the base branch and passes after the re-pin.
- `actionPin returns the sha and version comment`: the positive case.
- `actionPin reports a stale comment tag rather than hiding it`: negative.
- `actionPin leaves comment undefined when none precedes the uses line`:
  negative.
- `actionPin returns undefined when the action is absent`: negative.

Branch outcomes:

- `test/GitleaksWorkflow.ts` `actionPin`, no matching `uses:` line → `undefined`:
  covered by `actionPin returns undefined when the action is absent`.
- `actionPin`, comment line matches → its tag is returned: covered by
  `actionPin returns the sha and version comment`.
- `actionPin`, no comment line → `comment: undefined`: covered by
  `actionPin leaves comment undefined when none precedes the uses line`.

All three are test-helper branches, not production code.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
