// Shared by test/ActionlintWorkflow.ts. Lives outside test/*.ts so it is
// imported by a test (and so mutation-checked) rather than run as a test entry
// point.

// Issue #102: a tagless digest pin gives Renovate/Dependabot no version to track; require rhysd/actionlint:X.Y.Z@sha256:<64 hex>.
export function isTaggedDigestPin(image: unknown): boolean {
  return typeof image === "string" &&
    /^rhysd\/actionlint:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/.test(image);
}
