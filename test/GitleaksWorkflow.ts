// Verifies the Gitleaks GitHub Actions workflow scans pull requests
// targeting milestone sub-issue branches, not just the exact top-level
// branches. In GitHub Actions filter globs "*" does not match "/", so
// branches: ["*"] silently excludes "milestone/<slug>" PRs. Tracked in
// issue #65.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/gitleaks.yml";

/**
 * Mirrors GitHub Actions' filter-pattern semantics for the subset used
 * here: "**" matches any characters including "/", "*" matches any
 * characters except "/", and everything else is matched literally.
 */
function matchesBranchFilter(branch: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    let regexSource = "";
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === "*" && pattern[i + 1] === "*") {
        regexSource += ".*";
        i++;
      } else if (pattern[i] === "*") {
        regexSource += "[^/]*";
      } else {
        regexSource += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }
    const regex = new RegExp(`^${regexSource}$`);
    return regex.test(branch);
  });
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
