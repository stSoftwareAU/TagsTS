// Verifies renovate.json keeps CI npm-install pins current under the 24h quarantine (Issue #70).
import { assert, assertEquals } from "@std/assert";

const RENOVATE_PATH = "renovate.json";
const WORKFLOW_PATH = ".github/workflows/markdown-lint.yml";

// deno-lint-ignore no-explicit-any
async function loadRenovateConfig(): Promise<any> {
  const text = await Deno.readTextFile(RENOVATE_PATH);
  return JSON.parse(text);
}

// deno-lint-ignore no-explicit-any
function findRegexCustomManager(config: any): any {
  const manager = (config.customManagers ?? []).find(
    // deno-lint-ignore no-explicit-any
    (m: any) => m.customType === "regex" && m.datasourceTemplate === "npm",
  );
  assert(
    manager,
    "expected a customType=regex, datasourceTemplate=npm customManagers entry",
  );
  return manager;
}

// Renovate file patterns are written in `/…/` regex literal form; strip the
// slashes and compile them so we can test them like any other RegExp.
function compileFilePattern(pattern: string): RegExp {
  assert(
    pattern.startsWith("/") && pattern.endsWith("/"),
    `expected a /…/ regex literal, got: ${pattern}`,
  );
  // The pattern is a managerFilePatterns entry read from renovate.json under
  // test, not user-controlled input, so there's no ReDoS surface here.
  return new RegExp(pattern.slice(1, -1)); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
}

interface MatchGroups {
  depName: string;
  currentValue: string;
}

// Runs every matchStrings pattern (as a global RegExp) against `text` and
// collects all `{ depName, currentValue }` captures, keeping the tests DRY.
function collectMatches(matchStrings: string[], text: string): MatchGroups[] {
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
      });
    }
  }
  return matches;
}

Deno.test("renovate.json parses and sets a 24 hour minimum release age", async () => {
  const config = await loadRenovateConfig();
  assertEquals(config.minimumReleaseAge, "24 hours");
});

Deno.test("renovate.json has a regex customManager targeting .github/workflows files", async () => {
  const config = await loadRenovateConfig();
  const manager = findRegexCustomManager(config);

  const patterns: string[] = manager.managerFilePatterns;
  assert(Array.isArray(patterns) && patterns.length > 0);

  const matchesAny = (path: string) =>
    patterns.some((p) => compileFilePattern(p).test(path));

  assert(
    matchesAny(".github/workflows/markdown-lint.yml"),
    "must match .github/workflows/markdown-lint.yml",
  );
  assert(
    !matchesAny("src/workflows/x.yml"),
    "must not match src/workflows/x.yml",
  );
  assert(
    !matchesAny(".github/workflows/sub/dir.txt"),
    "must not match .github/workflows/sub/dir.txt",
  );
});

Deno.test("renovate.json customManager matches the pinned markdownlint-cli2 install", async () => {
  const config = await loadRenovateConfig();
  const manager = findRegexCustomManager(config);
  const matchStrings: string[] = manager.matchStrings;

  const workflowText = await Deno.readTextFile(WORKFLOW_PATH);
  const versionMatch = workflowText.match(/markdownlint-cli2@(\d+\.\d+\.\d+)/);
  assert(
    versionMatch,
    "workflow must pin markdownlint-cli2 to an exact version",
  );
  const expectedVersion = versionMatch[1];

  const matches = collectMatches(matchStrings, workflowText);
  assertEquals(
    matches.length,
    1,
    "expected exactly one match in the workflow file",
  );
  assertEquals(matches[0].depName, "markdownlint-cli2");
  assertEquals(matches[0].currentValue, expectedVersion);
});

Deno.test("renovate.json customManager ignores unpinned or range-pinned npm installs", async () => {
  const config = await loadRenovateConfig();
  const manager = findRegexCustomManager(config);
  const matchStrings: string[] = manager.matchStrings;

  for (
    const line of [
      "npm install -g markdownlint-cli2",
      "npm install -g markdownlint-cli2@latest",
      "npm install -g markdownlint-cli2@^0.23.3",
    ]
  ) {
    assertEquals(
      collectMatches(matchStrings, line).length,
      0,
      `must not match: ${line}`,
    );
  }
});

// Renovate compiles matchStrings/managerFilePatterns with RE2 (node-re2) on
// the hosted app, which rejects look-around and backreferences even though
// Deno's `new RegExp` above accepts them happily. Named groups such as
// `(?<depName>` are RE2-safe and must not trip this check.
const RE2_UNSAFE_CONSTRUCT = /\(\?[=!]|\(\?<[=!]|\\[1-9]/;

Deno.test("renovate.json customManager patterns avoid RE2-incompatible constructs", async () => {
  const config = await loadRenovateConfig();
  const manager = findRegexCustomManager(config);
  const patterns: string[] = [
    ...manager.matchStrings,
    ...manager.managerFilePatterns,
  ];

  for (const pattern of patterns) {
    assert(
      !RE2_UNSAFE_CONSTRUCT.test(pattern),
      `pattern uses a look-around or backreference RE2 cannot compile, so ` +
        `Renovate would reject the whole config: ${pattern}`,
    );
  }
});

Deno.test("renovate.json customManager matches scoped packages and npm i/add aliases", async () => {
  const config = await loadRenovateConfig();
  const manager = findRegexCustomManager(config);
  const matchStrings: string[] = manager.matchStrings;

  const scoped = collectMatches(
    matchStrings,
    "npm install -g @scope/pkg@1.2.3",
  );
  assertEquals(scoped.length, 1);
  assertEquals(scoped[0].depName, "@scope/pkg");
  assertEquals(scoped[0].currentValue, "1.2.3");

  const aliased = collectMatches(matchStrings, "npm i --global foo@4.5.6");
  assertEquals(aliased.length, 1);
  assertEquals(aliased[0].depName, "foo");
  assertEquals(aliased[0].currentValue, "4.5.6");
});
