// Verifies the Dependency review GitHub Actions workflow runs on pull requests
// targeting milestone sub-issue branches, not just the exact top-level
// branch. In GitHub Actions filter globs "*" does not match "/", so
// branches: ["Develop"] silently excludes "milestone/<slug>" PRs. Tracked in
// issue #96.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";
import { matchesBranchFilter } from "../tools/BranchFilter.ts";

const WORKFLOW_PATH = ".github/workflows/dependency-review.yml";

Deno.test("dependency-review branch filter helper mirrors GitHub glob semantics", () => {
  assertEquals(matchesBranchFilter("milestone/foo", ["Develop"]), false);
  assertEquals(matchesBranchFilter("milestone/foo", ["milestone/*"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["milestone/*"]), false);
  assertEquals(
    matchesBranchFilter("Develop", ["Develop", "milestone/*"]),
    true,
  );
  assertEquals(matchesBranchFilter("milestone/foo", ["*"]), false);
  // "**" crosses "/", "*" does not, and everything else is literal.
  assertEquals(matchesBranchFilter("milestone/a/b", ["milestone/**"]), true);
  assertEquals(matchesBranchFilter("milestone/", ["milestone/*"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["**"]), true);
  assertEquals(matchesBranchFilter("foo", ["*"]), true);
  assertEquals(matchesBranchFilter("", ["*"]), true);
  assertEquals(matchesBranchFilter("a/b", ["*/b"]), true);
  assertEquals(matchesBranchFilter("a/c/b", ["*/b"]), false);
  assertEquals(matchesBranchFilter("Develop", ["Develo"]), false);
  assertEquals(matchesBranchFilter("Develo", ["Develop"]), false);
  assertEquals(matchesBranchFilter("Develop", ["develop"]), false);
  assertEquals(matchesBranchFilter("Develop", []), false);
  assertEquals(matchesBranchFilter("milestone/x", ["milestone/**x"]), true);
  assertEquals(matchesBranchFilter("milestone/x", ["milestone/**y"]), false);
});

Deno.test("dependency-review workflow runs on PRs targeting Develop and milestone branches", async () => {
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

  for (const branch of ["Develop", "milestone/issue-96-slug"]) {
    assert(
      matchesBranchFilter(branch, branches),
      `expected branch '${branch}' to match the pull_request filter`,
    );
  }
});

Deno.test("dependency-review workflow does not run on unrelated branches", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;

  const branches = doc.on.pull_request.branches;
  assert(
    !matchesBranchFilter("feature/foo", branches),
    "expected branch 'feature/foo' to not match the pull_request filter",
  );
});
