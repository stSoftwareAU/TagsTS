# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The patch number is
incremented automatically on each pull request to `Develop`, and every merge
publishes a release; see [CONTRIBUTING.md](CONTRIBUTING.md#version-bumps).

## [Unreleased]

### Added

- `CONTRIBUTING.md` describing the branch model, quality gate and automatic
  version bump.
- This changelog.

## [1.0.21] - 2026-09-29

### Added

- `SECURITY.md` vulnerability disclosure policy
  ([#81](https://github.com/stSoftwareAU/TagsTS/pull/81), issue #54).

## [1.0.20] - 2026-09-29

### Added

- actionlint CI gate for GitHub Actions workflows
  ([#86](https://github.com/stSoftwareAU/TagsTS/pull/86), issue #58).

## [1.0.19] - 2026-09-29

### Added

- A CycloneDX SBOM attached to each GitHub Release
  ([#85](https://github.com/stSoftwareAU/TagsTS/pull/85), issue #57).

## [1.0.18] - 2026-09-29

### Security

- The spellcheck workflow token is restricted to read-only contents
  ([#88](https://github.com/stSoftwareAU/TagsTS/pull/88), issue #59).

## [1.0.17] - 2026-09-29

### Changed

- The test gate uses the quieter dot reporter
  ([#82](https://github.com/stSoftwareAU/TagsTS/pull/82), issue #55).

## [1.0.16] - 2026-09-29

### Removed

- The advanced CodeQL workflow that conflicted with the default setup
  ([#87](https://github.com/stSoftwareAU/TagsTS/pull/87)).

## [1.0.15] - 2026-09-28

See the
[GitHub Release](https://github.com/stSoftwareAU/TagsTS/releases/tag/v1.0.15)
for the generated notes.

## [1.0.14] and earlier

Changes before this changelog was introduced are recorded only in the
[GitHub Releases history](https://github.com/stSoftwareAU/TagsTS/releases).

[Unreleased]: https://github.com/stSoftwareAU/TagsTS/compare/v1.0.21...HEAD
[1.0.21]: https://github.com/stSoftwareAU/TagsTS/compare/v1.0.20...v1.0.21
[1.0.20]: https://github.com/stSoftwareAU/TagsTS/compare/v1.0.19...v1.0.20
[1.0.19]: https://github.com/stSoftwareAU/TagsTS/compare/v1.0.18...v1.0.19
[1.0.18]: https://github.com/stSoftwareAU/TagsTS/compare/v1.0.17...v1.0.18
[1.0.17]: https://github.com/stSoftwareAU/TagsTS/compare/v1.0.16...v1.0.17
[1.0.16]: https://github.com/stSoftwareAU/TagsTS/compare/v1.0.15...v1.0.16
[1.0.15]: https://github.com/stSoftwareAU/TagsTS/compare/v1.0.14...v1.0.15
[1.0.14]: https://github.com/stSoftwareAU/TagsTS/releases/tag/v1.0.14
