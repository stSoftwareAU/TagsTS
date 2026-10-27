// Shared by test/RenovateConfig.ts. Lives outside test/*.ts so it is imported
// by a test (and so mutation-checked) rather than run as a test entry point.
export interface MatchGroups {
  depName: string;
  currentValue: string;
  currentDigest?: string;
}

// Runs every matchStrings pattern (as a global RegExp) against `text` and
// collects all `{ depName, currentValue, currentDigest }` captures, keeping the
// tests DRY. currentDigest is undefined when the pattern has no such group.
export function collectMatches(
  matchStrings: string[],
  text: string,
): MatchGroups[] {
  const matches: MatchGroups[] = [];
  for (const pattern of matchStrings) {
    // The pattern is a matchStrings entry read from renovate.json under
    // test, not user-controlled input, so there's no ReDoS surface here.
    const re = new RegExp(pattern, "g"); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    for (const match of text.matchAll(re)) {
      const groups = match.groups ?? {};
      matches.push({
        depName: groups.depName,
        currentValue: groups.currentValue,
        currentDigest: groups.currentDigest,
      });
    }
  }
  return matches;
}
