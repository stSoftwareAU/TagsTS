# PR Summary — Issue #102

## Summary

Closes #102. The actionlint image in `.github/workflows/actionlint.yml` was
pinned as `rhysd/actionlint@sha256:<digest>` with no tag, and Renovate's
`github-actions` manager never parses `run:` shell, so no bump could be offered.

- [x] Re-pin as `rhysd/actionlint:1.7.12@sha256:b1934ee5…` (the existing digest)
- [x] Add a second regex `customManagers` entry (`datasourceTemplate: docker`)
      to `renovate.json` capturing `depName`, `currentValue` and `currentDigest`
- [x] Extend `test/ActionlintWorkflow.ts` to require the `tag@digest` form
- [x] Add docker-manager tests to `test/RenovateConfig.ts`
- [x] Describe the new entry in `README.md`

## Evidence

- `deno test --allow-all test/RenovateConfig.ts test/ActionlintWorkflow.ts`:
  `ok | 18 passed | 0 failed`.
- **Docs sweep** — grep: `rhysd/actionlint`, `customManagers`, `regex`,
  `minimumReleaseAge`, `github-actions manager`; section:
  `README.md#dependency-quarantine`; siblings: the existing npm regex
  `customManagers` entry described in the same paragraph; updated: `README.md`
  (the paragraph now describes the second regex entry for the actionlint image
  pin and why `github-actions` does not cover it).
- No existing assertion was removed or loosened. The first draft of
  `findRegexCustomManager` parameterised its failure message; that is reverted,
  and a separate `findDockerCustomManager` helper is added so the original npm
  assertion is unchanged.

## Test Plan

- No assertion was removed from an existing test. `findRegexCustomManager`'s
  `assert(manager, "expected a customType=regex, datasourceTemplate=npm customManagers entry")`
  is intact.
- `test/ActionlintWorkflow.ts`: the real-workflow test now locates the image
  with `ACTIONLINT_IMAGE_REF` (tag optional) and asserts `isTaggedDigestPin`; a
  new test covers the guard's accepted and rejected forms.
- `test/RenovateConfig.ts`: six new tests cover the docker manager (shape, real
  workflow capture, negative refs, RE2 safety, file pattern, and no overlap with
  the npm manager).
- The real-workflow capture test derives the expected version from the
  workflow text (`pinned[1]`) rather than typing `1.7.12`, so a Renovate bump
  PR keeps CI green; the semver-format assertion stays.
- Flips: deleting `currentDigest: groups.currentDigest` in `collectMatches`
  (`test/RenovateConfig.ts:72`) turned the real-workflow capture test red; changing the guard test's final
  expected `true` to `false` turned it red.

**Branch outcomes:**

- `test/ActionlintWorkflow.ts:14` — error (non-string / tagless / floating /
  short or upper-case digest / range tag rejected) —
  `test/ActionlintWorkflow.ts::tagged digest pin guard rejects tagless, floating and malformed pins`
  — flipped to accept, test went red
- `test/ActionlintWorkflow.ts:14` — success (`X.Y.Z@sha256:<64 hex>` accepted) —
  `test/ActionlintWorkflow.ts::tagged digest pin guard rejects tagless, floating and malformed pins`
  — flipped the expected value, test went red
- `test/ActionlintWorkflow.ts:79` — error (real workflow image not tag@digest) —
  `test/ActionlintWorkflow.ts::actionlint job runs the digest-pinned rhysd/actionlint image`
  — tagless pin made the test go red
- `renovate.json:20` — success (version and digest captured) —
  `test/RenovateConfig.ts::renovate docker manager captures the actionlint version and digest pin in the real workflow`
  — went red when `currentDigest` was dropped from the collected groups
- `renovate.json:20` — absent (tagless, `latest`, untagged, short digest, range
  tag not matched) —
  `test/RenovateConfig.ts::renovate docker manager ignores tagless, untagged, short-digest or range-tagged actionlint refs`
  — loosening the pattern turns it red
- `renovate.json:18` — success (file pattern matches the workflow) —
  `test/RenovateConfig.ts::renovate docker manager file patterns match .github/workflows/actionlint.yml`
- `renovate.json:20` — absent (npm and docker managers do not overlap) —
  `test/RenovateConfig.ts::renovate npm and docker managers do not capture each other's pins`

## Mutation survivors

The mutation tool reports survivors only in test files
(`test/ActionlintWorkflow.ts` and `test/RenovateConfig.ts`) with "no test
imports this module": a test file is not imported by another test, so mutating
its assertions cannot be observed by the harness. Run directly, these mutations
do go red (see Flips above). Harness search: `grep -rn "RenovateConfig\|ActionlintWorkflow" test/`
finds no importer; each file is a leaf test entry point.

- `test/RenovateConfig.ts:37` exempt (untestable): `return manager` of the test helper `findDockerCustomManager`; no test imports the file
- `test/RenovateConfig.ts:72` exempt (untestable): `currentDigest: groups.currentDigest` in test helper `collectMatches`; deleting it turns the real-workflow capture test red when run directly
- `test/RenovateConfig.ts:200` exempt (untestable): assertion inside a test body; no module imports it
- `test/RenovateConfig.ts:201` exempt (untestable): assertion inside a test body; no module imports it
- `test/RenovateConfig.ts:216` exempt (untestable): assertion inside a test body; no module imports it
- `test/RenovateConfig.ts:223` exempt (untestable): assertion inside a test body; no module imports it
- `test/RenovateConfig.ts:308` exempt (untestable): assertion inside a test body; no module imports it
- `test/RenovateConfig.ts:309` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:91` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:95` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:96` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:97` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:101` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:105` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:109` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:113` exempt (untestable): assertion inside a test body; no module imports it
- `test/ActionlintWorkflow.ts:115` exempt (untestable): assertion inside a test body; no module imports it
