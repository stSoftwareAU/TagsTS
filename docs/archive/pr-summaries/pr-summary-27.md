## Summary

Upgrade the Markdown Lint workflow to Node.js 24-compatible action versions.
GitHub deprecated Node.js 20 runners on the GitHub Actions platform; the
existing pins for `actions/checkout@v4` and `actions/setup-node@v4` triggered
deprecation warnings on every run. This PR repins both actions to their
v5 commit SHAs, which ship with Node.js 24. Closes #27.

## Evidence

Backend/workflow change — no UI to screenshot. Verified by:

- `./quality.sh` passes locally (17 tests, 0 failures).
- New regression tests fail against the previous v4 SHAs and pass with the
  v5 SHAs (see Test Plan below).

Pin changes in `.github/workflows/markdown-lint.yml`:

| Action | Before (Node 20) | After (Node 24) |
| --- | --- | --- |
| `actions/checkout` | `34e114876b0b11c390a56381ad16ebd13914f8d5` (v4) | `93cb6efe18208431cddfb8368fd83d5badbf9bfd` (v5) |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` (v4) | `a0853c24544627f65ddf259abe73b1d18a591444` (v5) |

## Test Plan

Added two regression tests to `test/MarkdownLintWorkflow.ts`:

- `markdown-lint workflow does not use deprecated Node 20 action SHAs` —
  asserts the old v4 SHAs for `actions/checkout` and `actions/setup-node`
  are no longer present.
- `markdown-lint workflow pins actions/checkout and actions/setup-node to
  Node 24 SHAs` — asserts the new v5 SHAs are pinned.
