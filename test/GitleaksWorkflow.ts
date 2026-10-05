// Verifies the Gitleaks GitHub Actions workflow scans pull requests
// targeting milestone sub-issue branches, not just the exact top-level
// branches. In GitHub Actions filter globs "*" does not match "/", so
// branches: ["*"] silently excludes "milestone/<slug>" PRs. Tracked in
// issue #65.
//
// Also verifies the workflow pins gitleaks-action to the expected
// release. Tracked in issue #68.
//
// Also verifies the checkout step does not persist the GITHUB_TOKEN into
// .git/config. Tracked in issue #71.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/gitleaks.yml";

/**
 * Mirrors GitHub Actions' filter-pattern semantics for the subset used
 * here: "**" matches any characters including "/", "*" matches any
 * characters except "/", and everything else is matched literally.
 *
 * Implemented as a backtracking matcher (no RegExp) so the glob
 * pattern never flows into a dynamically constructed regular
 * expression.
 */
function matchesBranchFilter(branch: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globMatch(branch, 0, pattern, 0));
}

function globMatch(
  text: string,
  textIndex: number,
  pattern: string,
  patternIndex: number,
): boolean {
  if (patternIndex === pattern.length) {
    return textIndex === text.length;
  }

  if (pattern[patternIndex] !== "*") {
    return (
      textIndex < text.length &&
      text[textIndex] === pattern[patternIndex] &&
      globMatch(text, textIndex + 1, pattern, patternIndex + 1)
    );
  }

  if (pattern[patternIndex + 1] === "*") {
    for (let i = textIndex; i <= text.length; i++) {
      if (globMatch(text, i, pattern, patternIndex + 2)) {
        return true;
      }
    }
    return false;
  }

  for (let i = textIndex; i <= text.length; i++) {
    if (globMatch(text, i, pattern, patternIndex + 1)) {
      return true;
    }
    if (text[i] === "/") break;
  }
  return false;
}

Deno.test("gitleaks branch filter helper mirrors GitHub glob semantics", () => {
  assertEquals(matchesBranchFilter("milestone/foo", ["*"]), false);
  assertEquals(matchesBranchFilter("Develop", ["*"]), true);
  assertEquals(matchesBranchFilter("milestone/foo", ["milestone/*"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["milestone/*"]), false);
  assertEquals(matchesBranchFilter("milestone/a/b", ["**"]), true);
  assertEquals(matchesBranchFilter("milestone/foo", ["*/*"]), true);
  assertEquals(matchesBranchFilter("milestone/foo", ["*/foo"]), true);
  assertEquals(
    matchesBranchFilter("releases/v1/hotfix", ["releases/*/hotfix"]),
    true,
  );
  assertEquals(
    matchesBranchFilter("milestone/issue-65-slug", ["*", "*/*"]),
    true,
  );
});

Deno.test("gitleaks workflow runs on PRs targeting Develop, main and milestone branches", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;

  const branches = doc.on.pull_request.branches;
  assert(Array.isArray(branches), "on.pull_request.branches must be an array");
  for (const branch of branches) {
    assert(
      typeof branch === "string",
      "on.pull_request.branches entries must be strings",
    );
  }

  for (const branch of ["Develop", "main", "milestone/issue-65-slug"]) {
    assert(
      matchesBranchFilter(branch, branches),
      `expected branch '${branch}' to match the pull_request filter`,
    );
  }
});

const ACTION = "gitleaks/gitleaks-action";
const EXPECTED_SHA = "e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e";
const EXPECTED_TAG = "v3.0.0";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * Scans `text` for a `- uses: <action>@<40-hex-sha>` line and returns the
 * pinned SHA plus the version tag from a `# <action>@<tag>` comment on the
 * immediately preceding line, if present.
 */
export function actionPin(
  text: string,
  action: string,
): { sha: string; comment: string | undefined } | undefined {
  const usesPrefix = `- uses: ${action}@`;
  const commentPrefix = `# ${action}@`;

  const lines = text.split("\n").map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith(usesPrefix)) continue;
    const sha = line.slice(usesPrefix.length);
    if (!SHA_PATTERN.test(sha)) continue;

    const previous = i > 0 ? lines[i - 1] : "";
    const comment = previous.startsWith(commentPrefix)
      ? previous.slice(commentPrefix.length)
      : undefined;
    return { sha, comment };
  }
  return undefined;
}

Deno.test("actionPin returns the sha and version comment", () => {
  const text = [
    "steps:",
    "  # some/action@v1.2.3",
    "  - uses: some/action@" + "a".repeat(40),
  ].join("\n");

  assertEquals(actionPin(text, "some/action"), {
    sha: "a".repeat(40),
    comment: "v1.2.3",
  });
});

Deno.test("actionPin reports a stale comment tag rather than hiding it", () => {
  const text = [
    "steps:",
    "  # some/action@v1.0.0",
    "  - uses: some/action@" + "b".repeat(40),
  ].join("\n");

  assertEquals(actionPin(text, "some/action"), {
    sha: "b".repeat(40),
    comment: "v1.0.0",
  });
});

Deno.test("actionPin leaves comment undefined when none precedes the uses line", () => {
  const text = [
    "steps:",
    "  - name: unrelated",
    "  - uses: some/action@" + "c".repeat(40),
  ].join("\n");

  assertEquals(actionPin(text, "some/action"), {
    sha: "c".repeat(40),
    comment: undefined,
  });
});

Deno.test("actionPin returns undefined when the action is absent", () => {
  const text = [
    "steps:",
    "  - uses: other/action@" + "d".repeat(40),
  ].join("\n");

  assertEquals(actionPin(text, "some/action"), undefined);
});

Deno.test("gitleaks workflow pins gitleaks-action to the expected release", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;
  const steps = doc.jobs.gitleaks.steps as Array<Record<string, unknown>>;

  const step = steps.find((s) =>
    typeof s.uses === "string" && s.uses.startsWith(`${ACTION}@`)
  );
  assert(step, `${ACTION} step must be present`);
  assertEquals(step!.uses, `${ACTION}@${EXPECTED_SHA}`);

  assertEquals(actionPin(text, ACTION), {
    sha: EXPECTED_SHA,
    comment: EXPECTED_TAG,
  });
});

/**
 * Returns the `uses` of every actions/checkout step in `steps` that does not
 * set `persist-credentials: false`, so the token is not left in .git/config.
 */
export function checkoutsPersistingCredentials(
  steps: Array<Record<string, unknown>>,
): string[] {
  return steps
    .filter((step) =>
      typeof step.uses === "string" && step.uses.startsWith("actions/checkout@")
    )
    .filter((step) =>
      (step.with as Record<string, unknown> | undefined)?.[
        "persist-credentials"
      ] !== false
    )
    .map((step) => step.uses as string);
}

Deno.test("checkoutsPersistingCredentials flags checkout steps missing persist-credentials: false", () => {
  assertEquals(
    checkoutsPersistingCredentials([
      {
        uses: "actions/checkout@" + "a".repeat(40),
        with: { "fetch-depth": 0, "persist-credentials": false },
      },
    ]),
    [],
  );

  assertEquals(
    checkoutsPersistingCredentials([
      {
        uses: "actions/checkout@" + "b".repeat(40),
        with: { "fetch-depth": 0 },
      },
    ]),
    ["actions/checkout@" + "b".repeat(40)],
  );

  assertEquals(
    checkoutsPersistingCredentials([
      { uses: "actions/checkout@" + "c".repeat(40) },
    ]),
    ["actions/checkout@" + "c".repeat(40)],
  );

  assertEquals(
    checkoutsPersistingCredentials([
      {
        uses: "actions/checkout@" + "d".repeat(40),
        with: { "persist-credentials": true },
      },
    ]),
    ["actions/checkout@" + "d".repeat(40)],
  );

  assertEquals(
    checkoutsPersistingCredentials([
      { uses: "gitleaks/gitleaks-action@" + "e".repeat(40) },
      { run: "echo" },
    ]),
    [],
  );
});

Deno.test("gitleaks job checks out without persisted credentials, keeping full history", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;
  const steps = doc.jobs.gitleaks.steps as Array<Record<string, unknown>>;

  const checkoutStep = steps.find((s) =>
    typeof s.uses === "string" && s.uses.startsWith("actions/checkout@")
  );
  assert(checkoutStep, "actions/checkout step must be present");

  assertEquals(checkoutsPersistingCredentials(steps), []);

  const withBlock = checkoutStep!.with as Record<string, unknown>;
  assertEquals(withBlock["fetch-depth"], 0);
});
