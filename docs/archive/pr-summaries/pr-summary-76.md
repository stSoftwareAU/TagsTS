# PR Summary — Issue #76

## Summary

Closes #76. `denoland/setup-deno` ran with no cache in `quality.yml` and
`markdown-lint.yml`, so each run downloaded every module again. Both jobs now
cache `~/.cache/deno` with `actions/cache` on an exact key, and there are no
`restore-keys`:

```text
deno-${{ runner.os }}-${{ runner.arch }}-${{ steps.setup-deno.outputs.deno-version }}-${{ hashFiles('deno.json') }}
```

- [x] Add `id: setup-deno` and a cache step to `quality.yml`, placed before
      `deno outdated`
- [x] Add the same cache step to `markdown-lint.yml`, gated on the same `if:`
      as setup-deno
- [x] Extend `test/QualityWorkflow.ts` and `test/MarkdownLintWorkflow.ts`
      with a `denoCacheProblems` validator and tests for each of its branches

## Spec

### Intent and Rationale

Stop re-downloading modules on every run. Because `deno.json` has
`"lock": false`, no lockfile pins the cached contents, so the key must miss
cleanly on any change to `deno.json` or the Deno version. It must never restore
a stale or poisoned near-match.

### Essential Design Decisions

- **setup-deno's own `cache: true` is not used.** In v2.0.4, `src/cache.ts`
  builds the primary key as
  `deno-cache-${RUNNER_OS}-${RUNNER_ARCH}-${GITHUB_JOB}-${cacheHash}`. It always
  passes `deno-cache-${RUNNER_OS}-${RUNNER_ARCH}` as a restore key, and the
  Deno version is not in the key. A broad fallback would therefore always
  apply, which is the stale-cache risk the issue warns about.
- **Exact key, no `restore-keys`.** The key contains the OS, the architecture,
  the resolved Deno version (setup-deno's `deno-version` output) and
  `hashFiles('deno.json')`. A change to any of them is a clean miss.
- **The key is computed before `deno outdated --update`.** actions/cache
  evaluates the key at restore time, so the hash is of the committed
  `deno.json`. The validator requires the cache step to come before
  `deno outdated`.
- **Saving happens only on success.** actions/cache v6.1.0 declares
  `post-if: success()`, so a failed job never saves its cache.
- **markdown-lint.yml** gates the cache step on the same
  `steps.detect-deno.outputs.present` condition as setup-deno. A repository
  without Deno skips both steps.

### Undiscoverable Facts

Both SHAs were resolved, not written from memory:

- `gh api repos/denoland/setup-deno/commits/v2.0.4` →
  `667a34cdef165d8d2b2e98dde39547c9daac7282`. This is the existing pin. Its
  `action.yml` has `cache` (default `false`), `cache-hash`, and a
  `deno-version` output.
- `gh api repos/actions/cache/commits/v6.1.0` →
  `55cc8345863c7cc4c66a329aec7e433d2d1c52a9`. It is a `node24` action with
  `post-if: success()`.

## Evidence

- `timeout 900 ./quality.sh < /dev/null`: `ok | 114 passed | 0 failed`.
- **Docs sweep:** grepped `*.md` (excluding the PR summaries) for
  `setup-deno|actions/cache|cache/deno|DENO_DIR`. There were no hits, so no
  README or doc describes the workflow cache. The only explanatory text is the
  new comment above each cache step.
- No existing assertion was removed or loosened.

## Test Plan

- **Red first:**
  - `quality workflow caches the Deno directory on an exact key` and
    `quality workflow Deno cache never falls back to a stale entry` failed
    against the base workflow, reporting
    `["setup-deno step must have id: setup-deno", "expected exactly one actions/cache step, found 0"]`.
  - `markdown-lint workflow caches the Deno directory on an exact key` failed
    with the same two problems.
- **Flips:**
  - Adding `restore-keys: deno-` to `quality.yml` turned both quality tests red.
  - Deleting the cache step's `if:` from `markdown-lint.yml` turned its test
    red.
  - Each was restored afterwards.
- **Branch outcomes:** each `problems.push` was disabled one at a time, and the
  named test went red each time.
  - `test/QualityWorkflow.ts`:
    - `:263` no setup-deno step: `flags no denoland/setup-deno step at all`
    - `:267` missing `id`: the real-workflow test, red on base
    - `:270` `cache: true`: `flags setup-deno with cache: true`
    - `:288` cache step count ≠ 1: `flags no cache step at all`
    - `:298` cache before setup-deno:
      `flags cache step placed before the setup-deno step`
    - `:301` cache after `deno outdated`:
      `flags cache step placed after deno outdated`
    - `:305` wrong path: `flags a cache path other than ~/.cache/deno`
    - `:312` no `deno-version` in the key:
      `flags a key missing the deno-version output`
    - `:317` no `deno.json` hash: `flags a key missing hashFiles('deno.json')`
    - `:320` no `runner.os`: `flags a key missing runner.os`
    - `:324` `restore-keys`: `flags a cache step with restore-keys present`
    - Valid result (empty array): `valid fixture yields no problems`, plus the
      real-workflow tests.
  - `test/MarkdownLintWorkflow.ts`:
    - `:141` no setup-deno step: `flags no denoland/setup-deno step at all`
    - `:147` missing `id`: the real-workflow test, red on base
    - `:151` `cache: true`: `flags setup-deno's own cache: true`
    - `:164` cache step count ≠ 1: `flags missing cache step`
    - `:173` cache before setup-deno:
      `flags cache step placed before the setup-deno step`
    - `:176` cache after check-mermaid:
      `flags cache step placed after check-mermaid`
    - `:182` `if:` mismatch: `flags cache step missing the if gate`
    - `:189` wrong path: `flags a cache path other than ~/.cache/deno`
    - `:197` no `deno-version` in the key:
      `flags key missing deno-version output`
    - `:202` no `deno.json` hash: `flags key missing deno.json hash`
    - `:205` no `runner.os`: `flags a key missing runner.os`
    - `:209` `restore-keys`: `flags restore-keys`
    - Valid result (empty array): `valid fixture reports no problems`, plus the
      real-workflow test.

## Security Self-Check

- [x] Every `uses:` is pinned to a 40-hex SHA resolved through `gh api`
      (`test/ActionPins.ts` enforces this).
- [x] No new permissions, secrets or `${{ github.* }}` interpolation in `run:`.
- [x] The cache key cannot fall back to a foreign or stale entry, because there
      are no `restore-keys`.
