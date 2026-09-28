## Summary

The JSR publish job held an OIDC `id-token: write` permission but ran
`npx jsr publish`, which fetches and executes whatever `jsr` npm release is
latest on every push to `Develop` (CWE-494). The job now installs an exact Deno
release (`v2.9.6`) through the SHA-pinned `denoland/setup-deno` action
(`v2.0.4`, SHA re-resolved with `gh api` this run) and publishes with the native
`deno publish`. The `jsr` npm wrapper only ever downloaded Deno and ran
`deno publish`, so the publish behaviour is unchanged, but no package resolved
from the registry at run time executes with the token in scope any more.

Closes #40.

```mermaid
flowchart LR
    A[push to Develop] --> B[checkout @SHA]
    B --> C[setup-deno @SHA, deno v2.9.6]
    C --> D[deno publish via OIDC]
```

## Evidence

CI/workflow-only change, so there is no UI to screenshot.

- Added `test/PublishWorkflow.ts::publish job runs no unpinned package runner`
  and
  `test/PublishWorkflow.ts::publish job installs an exact Deno version before publishing`.
  Both reproduce the flaw: they **failed against the unfixed `publish.yml`**
  (`npx jsr publish` was flagged, and there was no pinned Deno set-up) and
  **pass after the fix**.
- `deno publish --dry-run` completes successfully locally ("Success Dry run
  complete"), so the new publish command works on this package.
- `./quality.sh` passes: 34 tests, 0 failed.

**Original trigger closed:** the publish job's only `run:` step is now
`deno publish`, run by a Deno binary fixed to the exact version `v2.9.6` and
installed by an action pinned to a commit SHA. No
`npx`/`bunx`/`pnpm dlx`/`yarn dlx` invocation is left to resolve a
registry-latest package. The regression test flags any unpinned package runner
added back to this job (including `@latest` and range specifiers), so there is
no easy way around the fix.

### Deno regression avoided

Replaced the Node-side `npx jsr publish` with the Deno-native `deno publish`
instead of pinning the npm wrapper.

## Test Plan

- Added `test/PublishWorkflow.ts`:
  - `unpinnedRunners flags package runners without an exact version`
  - `unpinnedRunners accepts exact pins and scripts without a runner`
  - `publish job runs no unpinned package runner`
  - `publish job installs an exact Deno version before publishing`
- The existing `test/ActionPins.ts` still passes (the new `uses:` is
  SHA-pinned).
