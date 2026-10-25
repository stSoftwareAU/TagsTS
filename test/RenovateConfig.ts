// Verifies renovate.json keeps CI npm-install pins current under the 24h quarantine (Issue #70).
import { assert, assertEquals } from "@std/assert";
import { collectMatches } from "./support/RenovateMatches.ts";

const RENOVATE_PATH = "renovate.json";
const WORKFLOW_PATH = ".github/workflows/markdown-lint.yml";
const ACTIONLINT_WORKFLOW_PATH = ".github/workflows/actionlint.yml";

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

// deno-lint-ignore no-explicit-any
function findDockerCustomManager(config: any): any {
  const manager = (config.customManagers ?? []).find(
    // deno-lint-ignore no-explicit-any
    (m: any) => m.customType === "regex" && m.datasourceTemplate === "docker",
  );
  assert(
    manager,
    "expected a customType=regex, datasourceTemplate=docker customManagers entry",
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

// Patterns follow Renovate's regex manager docs (docs.renovatebot.com/modules/manager/regex/): named groups depName/currentValue/currentDigest, datasourceTemplate, /regex/ file patterns, RE2 engine.
const ACTIONLINT_DIGEST =
  "b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667";

Deno.test("renovate docker manager is a regex customManager with datasourceTemplate docker", async () => {
  const config = await loadRenovateConfig();
  const manager = findDockerCustomManager(config);
  assertEquals(manager.customType, "regex");
  assertEquals(manager.datasourceTemplate, "docker");
});

Deno.test("renovate docker manager captures the actionlint version and digest pin in the real workflow", async () => {
  const config = await loadRenovateConfig();
  const manager = findDockerCustomManager(config);
  const matchStrings: string[] = manager.matchStrings;

  const workflowText = await Deno.readTextFile(ACTIONLINT_WORKFLOW_PATH);
  const matches = collectMatches(matchStrings, workflowText);
  assertEquals(
    matches.length,
    1,
    "expected exactly one rhysd/actionlint pin in the workflow file",
  );
  assertEquals(matches[0].depName, "rhysd/actionlint");
  // Derived from the workflow, not typed in: a Renovate bump must keep this green.
  const pinned = workflowText.match(/rhysd\/actionlint:(\d+\.\d+\.\d+)@/);
  assert(
    pinned,
    "workflow must pin rhysd/actionlint as <X.Y.Z>@sha256:<digest>",
  );
  assertEquals(matches[0].currentValue, pinned[1]);
  assert(
    /^\d+\.\d+\.\d+$/.test(matches[0].currentValue),
    `currentValue must be a plain version, got: ${matches[0].currentValue}`,
  );
  assert(
    /^sha256:[a-f0-9]{64}$/.test(matches[0].currentDigest ?? ""),
    `currentDigest must be sha256 followed by 64 hex, got: ${
      matches[0].currentDigest
    }`,
  );
});

Deno.test("renovate docker manager ignores tagless, untagged, short-digest or range-tagged actionlint refs", async () => {
  const config = await loadRenovateConfig();
  const manager = findDockerCustomManager(config);
  const matchStrings: string[] = manager.matchStrings;

  // Positive control: the well-formed pin must match, so an empty result
  // below cannot come from a broken pattern.
  assertEquals(
    collectMatches(
      matchStrings,
      `rhysd/actionlint:1.7.12@sha256:${ACTIONLINT_DIGEST}`,
    ).length,
    1,
    "well-formed pin must match",
  );

  for (
    const line of [
      `rhysd/actionlint@sha256:${ACTIONLINT_DIGEST}`,
      "rhysd/actionlint:latest",
      "rhysd/actionlint:1.7.12",
      `rhysd/actionlint:1.7.12@sha256:${ACTIONLINT_DIGEST.slice(0, 63)}`,
      `rhysd/actionlint:^1.7.12@sha256:${ACTIONLINT_DIGEST}`,
    ]
  ) {
    assertEquals(
      collectMatches(matchStrings, line).length,
      0,
      `must not match: ${line}`,
    );
  }
});

Deno.test("renovate docker manager patterns avoid RE2-incompatible constructs", async () => {
  const config = await loadRenovateConfig();
  const manager = findDockerCustomManager(config);
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

Deno.test("renovate docker manager file patterns match .github/workflows/actionlint.yml", async () => {
  const config = await loadRenovateConfig();
  const manager = findDockerCustomManager(config);
  const patterns: string[] = manager.managerFilePatterns;

  assert(
    patterns.some((p) => compileFilePattern(p).test(ACTIONLINT_WORKFLOW_PATH)),
    `must match ${ACTIONLINT_WORKFLOW_PATH}`,
  );
});

Deno.test("renovate npm and docker managers do not capture each other's pins", async () => {
  const config = await loadRenovateConfig();
  const npmManager = findRegexCustomManager(config);
  const dockerManager = findDockerCustomManager(config);
  const npmMatchStrings: string[] = npmManager.matchStrings;
  const dockerMatchStrings: string[] = dockerManager.matchStrings;

  const dockerPin = `rhysd/actionlint:1.7.12@sha256:${ACTIONLINT_DIGEST}`;
  const npmPin = "npm install -g markdownlint-cli2@0.23.3";

  // Positive controls: each manager matches its own pin.
  assertEquals(collectMatches(dockerMatchStrings, dockerPin).length, 1);
  assertEquals(collectMatches(npmMatchStrings, npmPin).length, 1);

  // Cross-checks: each manager ignores the other's pin.
  assertEquals(
    collectMatches(npmMatchStrings, dockerPin).length,
    0,
    `npm manager must not match: ${dockerPin}`,
  );
  assertEquals(
    collectMatches(dockerMatchStrings, npmPin).length,
    0,
    `docker manager must not match: ${npmPin}`,
  );
});
