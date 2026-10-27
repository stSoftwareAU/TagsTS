// Verifies the dependency-review workflow also runs for PRs into
// milestone/<slug> branches, not just Develop. Tracked in issue #96.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";
import { matchesBranchFilter } from "../tools/BranchFilter.ts";

const WORKFLOW_PATH = ".github/workflows/dependency-review.yml";

Deno.test("dependency-review pull_request filter matches Develop and milestone branches", async () => {
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

Deno.test("dependency-review pull_request filter does not match unrelated or nested branches", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;
  const branches: string[] = doc.on.pull_request.branches;

  for (const branch of ["feature/foo", "milestone/a/b"]) {
    assertEquals(
      matchesBranchFilter(branch, branches),
      false,
      `expected branch '${branch}' not to match the pull_request filter`,
    );
  }
});

Deno.test("dependency-review workflow still runs on opened/synchronize/reopened/ready_for_review", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;

  assertEquals(doc.on.pull_request.types, [
    "opened",
    "synchronize",
    "reopened",
    "ready_for_review",
  ]);
});
