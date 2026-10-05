# PR Summary — Issue #74

## Summary

Closes #74. The Semgrep job container was pinned by a tagless digest
(`semgrep/semgrep@sha256:7cad2bc2…a03`), so Renovate had no version to track. It
is now `semgrep/semgrep:1.163.0@sha256:7cad2bc2…a03`. The digest is unchanged,
so the job runs the identical image.

- [x] Resolve the release tag for the pinned digest
- [x] Re-pin as `tag@digest` and update the comment
- [x] Extend `test/SemgrepWorkflow.ts` to require the `tag@digest` form

## Spec

### Intent and Rationale

Keep the immutable digest pin, which protects `SEMGREP_APP_TOKEN` (Issue #18),
and add the tag so dependency bots can offer bumps.

### Essential Design Decisions

- The digest is byte-identical; only the tag was inserted, so this PR does not
  change the image.
- The validator accepts only
  `semgrep/semgrep:X.Y.Z@sha256:<64 lowercase
  hex>`. It rejects a tagless
  digest, a floating tag such as `latest`, a tag without a digest, and a
  malformed digest.

### Undiscoverable Facts

The tag was resolved, not guessed:

- Docker Hub tags API (`hub.docker.com/v2/repositories/semgrep/semgrep/tags`):
  `1.163.0` has `digest`
  `sha256:7cad2bc2d1e44f87f0bf4be6d1fa23aa90fb72015bebc89fb91385d813987a03`,
  last updated 2026-05-13.
- Registry `HEAD /v2/semgrep/semgrep/manifests/1.163.0`: it returned
  `content-type: application/vnd.oci.image.index.v1+json` and
  `docker-content-digest: sha256:7cad2bc2d1e44f87f0bf4be6d1fa23aa90fb72015bebc89fb91385d813987a03`.
  This is the multi-arch index digest, which matches the existing pin.

## Evidence

- `timeout 900 ./quality.sh < /dev/null`: `ok | 88 passed | 0 failed`.
- **Docs sweep:** grepped for `semgrep/semgrep` and `7cad2bc2` in `*.md`,
  `*.ts`, `*.json` and `*.yml`. Only two places hit:
  - `.github/workflows/semgrep.yml`: the pin comment was updated.
  - `test/SemgrepWorkflow.ts`: the assertion was updated.

  No README or other doc mentions the pin. The header comment at
  `.github/workflows/semgrep.yml:5-7` ("pinned to a digest") is still true.

## Test Plan

- Red first: against the old tagless pin,
  `semgrep workflow parses as
  YAML and defines semgrep job` failed with
  `container image must be
  pinned as semgrep/semgrep:X.Y.Z@sha256:<digest>`.
  It passes after the re-pin.
- New guard test:
  `tagged digest pin guard rejects tagless, floating and
  malformed pins`.
  - Negative cases: tagless, `latest`, no digest, 63-hex digest, uppercase hex,
    `undefined`.
  - Positive case: `1.163.0@sha256:<64 hex>`.
- Branch outcomes:
  - `test/SemgrepWorkflow.ts:9` `isTaggedDigestPin`, accept: reached by the
    positive case and by the real workflow assertion.
  - `test/SemgrepWorkflow.ts:9` `isTaggedDigestPin`, reject: reached by the six
    negative cases, and by the workflow assertion run against the base pin,
    which went red.
