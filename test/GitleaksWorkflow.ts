// Verifies the Gitleaks GitHub Actions workflow scans pull requests
// targeting milestone sub-issue branches, not just the exact top-level
// branches. In GitHub Actions filter globs "*" does not match "/", so
// branches: ["*"] silently excludes "milestone/<slug>" PRs. Tracked in
// issue #65.
//
// Also verifies the workflow pins gitleaks-action to the expected
// release. Tracked in issue #68.
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

  for (let i = textIndex; i <= text.length && text[i] !== "/"; i++) {
    if (globMatch(text, i, pattern, patternIndex + 1)) {
      return true;
    }
  }
  return false;
}

Deno.test("gitleaks branch filter helper mirrors GitHub glob semantics", () => {
  assertEquals(matchesBranchFilter("milestone/foo", ["*"]), false);
  assertEquals(matchesBranchFilter("Develop", ["*"]), true);
  assertEquals(matchesBranchFilter("milestone/foo", ["milestone/*"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["milestone/*"]), false);
  assertEquals(matchesBranchFilter("milestone/a/b", ["**"]), true);
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

/** Escapes `text` for use inside a `RegExp`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scans `text` for a `- uses: <action>@<40-hex-sha>` line and returns the
 * pinned SHA plus the version tag from a `# <action>@<tag>` comment on the
 * immediately preceding line, if present.
 */
export function actionPin(
  text: string,
  action: string,
): { sha: string; comment: string | undefined } | undefined {
  const usesPattern = new RegExp(
    `^- uses: ${escapeRegExp(action)}@([0-9a-f]{40})$`,
  );
  const commentPattern = new RegExp(
    `^# ${escapeRegExp(action)}@(.+)$`,
  );

  const lines = text.split("\n").map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const match = usesPattern.exec(lines[i]);
    if (!match) continue;

    const previous = i > 0 ? lines[i - 1] : "";
    const commentMatch = commentPattern.exec(previous);
    return {
      sha: match[1],
      comment: commentMatch ? commentMatch[1] : undefined,
    };
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
