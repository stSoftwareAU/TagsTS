// Pins the GitHub Actions branch-filter glob matcher that the workflow
// tests share. Tracked in issue #94.
import { assertEquals } from "@std/assert";
import { matchesBranchFilter } from "../tools/BranchFilter.ts";

Deno.test("branch filter: a single star stops at a slash", () => {
  assertEquals(matchesBranchFilter("Develop", ["*"]), true);
  assertEquals(matchesBranchFilter("milestone/foo", ["*"]), false);
  assertEquals(matchesBranchFilter("", ["*"]), true);
  assertEquals(matchesBranchFilter("milestone/foo", ["milestone/*"]), true);
  assertEquals(matchesBranchFilter("milestone/", ["milestone/*"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["milestone/*"]), false);
  assertEquals(matchesBranchFilter("milestone/foo", ["*/*"]), true);
  assertEquals(matchesBranchFilter("milestone/foo", ["*/foo"]), true);
  assertEquals(matchesBranchFilter("milestone/foo", ["*/bar"]), false);
  assertEquals(
    matchesBranchFilter("releases/v1/hotfix", ["releases/*/hotfix"]),
    true,
  );
  assertEquals(
    matchesBranchFilter("releases/v1/other", ["releases/*/hotfix"]),
    false,
  );
});

Deno.test("branch filter: a double star crosses slashes", () => {
  assertEquals(matchesBranchFilter("milestone/a/b", ["**"]), true);
  assertEquals(matchesBranchFilter("", ["**"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["milestone/**"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["**/b"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["**/c"]), false);
  assertEquals(matchesBranchFilter("other/a/b", ["milestone/**"]), false);
});

Deno.test("branch filter: literal patterns match exactly", () => {
  assertEquals(matchesBranchFilter("main", ["main"]), true);
  assertEquals(matchesBranchFilter("main", ["master"]), false);
  assertEquals(matchesBranchFilter("main", ["mai"]), false);
  assertEquals(matchesBranchFilter("mai", ["main"]), false);
  assertEquals(matchesBranchFilter("main2", ["main"]), false);
  assertEquals(matchesBranchFilter("main", []), false);
});

Deno.test("branch filter: any listed pattern may match", () => {
  assertEquals(
    matchesBranchFilter("milestone/issue-94-slug", ["*", "milestone/*"]),
    true,
  );
  assertEquals(
    matchesBranchFilter("milestone/issue-94-slug", ["*", "*/*"]),
    true,
  );
  assertEquals(matchesBranchFilter("milestone/issue-94-slug", ["*"]), false);
});
