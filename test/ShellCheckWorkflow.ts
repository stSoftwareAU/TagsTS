// Verifies the ShellCheck GitHub Actions workflow file exists and is
// well-formed YAML. Tracked in issues #20 and #63.
//
// Also verifies the pull_request filter runs on PRs targeting milestone
// sub-issue branches. In GitHub Actions filter globs "*" does not match
// "/", so branches: ["*"] silently excludes "milestone/<slug>" PRs. Tracked
// in issue #94.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/shellcheck.yml";

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

Deno.test("shellcheck branch filter helper mirrors GitHub glob semantics", () => {
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
    matchesBranchFilter("milestone/issue-94-slug", ["*", "*/*"]),
    true,
  );
});

Deno.test("shellcheck workflow file exists", async () => {
  const stat = await Deno.stat(WORKFLOW_PATH);
  assert(stat.isFile, `${WORKFLOW_PATH} should be a regular file`);
});

Deno.test("shellcheck workflow parses as YAML and defines shellcheck job", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;

  assertEquals(doc.name, "ShellCheck");
  assert(doc.jobs?.shellcheck, "jobs.shellcheck must be defined");
  assertEquals(doc.jobs.shellcheck["runs-on"], "ubuntu-latest");

  const steps = doc.jobs.shellcheck.steps as Array<Record<string, unknown>>;
  assert(
    Array.isArray(steps) && steps.length > 0,
    "steps must be a non-empty array",
  );

  const usesValues = steps
    .map((s) => (typeof s.uses === "string" ? s.uses : ""))
    .join("\n");
  assert(
    usesValues.includes("ludeeus/action-shellcheck"),
    "workflow must invoke ludeeus/action-shellcheck",
  );
});

Deno.test("shellcheck workflow pins third-party actions to commit SHAs", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;
  const steps = doc.jobs.shellcheck.steps as Array<Record<string, unknown>>;

  for (const step of steps) {
    const uses = typeof step.uses === "string" ? step.uses : "";
    if (!uses) continue;
    const ref = uses.split("@")[1] ?? "";
    assert(
      /^[0-9a-f]{40}$/.test(ref),
      `step uses '${uses}' must be pinned to a 40-char commit SHA, not a tag/branch`,
    );
  }
});

Deno.test("shellcheck workflow checks out without persisted credentials", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;
  const steps = doc.jobs.shellcheck.steps as Array<Record<string, unknown>>;

  const checkouts = steps.filter((s) =>
    typeof s.uses === "string" && s.uses.startsWith("actions/checkout@")
  );
  assert(checkouts.length > 0, "shellcheck job must check out the repo");
  for (const checkout of checkouts) {
    // deno-lint-ignore no-explicit-any
    assertEquals((checkout.with as any)?.["persist-credentials"], false);
  }
});

Deno.test("shellcheck workflow runs on PRs targeting Develop, main and milestone branches", async () => {
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

  for (const branch of ["Develop", "main", "milestone/issue-94-slug"]) {
    assert(
      matchesBranchFilter(branch, branches),
      `expected branch '${branch}' to match the pull_request filter`,
    );
  }

  assertEquals(
    matchesBranchFilter("milestone/issue-94-slug", ["*"]),
    false,
    'a bare ["*"] filter must not match milestone/<slug> branches',
  );
});
