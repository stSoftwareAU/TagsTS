// Pins the shared branch-glob matcher directly (issue #96), including the
// no-match paths of "**" and a literal pattern longer than the branch.
import { assertEquals } from "@std/assert";
import { matchesBranchFilter } from "./support/BranchFilter.ts";

Deno.test("branch filter '**' backtracks and reports no match when the tail never matches", () => {
  assertEquals(matchesBranchFilter("a/y", ["**/x"]), false);
  assertEquals(matchesBranchFilter("a/x", ["**/x"]), true);
  assertEquals(matchesBranchFilter("a/b/x", ["**/x"]), true);
  assertEquals(matchesBranchFilter("a/b/y", ["**/x"]), false);
});

Deno.test("branch filter literal pattern longer than the branch does not match", () => {
  assertEquals(matchesBranchFilter("milestone", ["milestone/x"]), false);
  assertEquals(matchesBranchFilter("milestone/", ["milestone/*"]), true);
  assertEquals(matchesBranchFilter("", ["a"]), false);
  assertEquals(matchesBranchFilter("a", ["a"]), true);
});

Deno.test("branch filter '*' matches within one path segment only", () => {
  assertEquals(matchesBranchFilter("milestone/a", ["milestone/*"]), true);
  assertEquals(matchesBranchFilter("milestone/a/b", ["milestone/*"]), false);
  assertEquals(matchesBranchFilter("Develop", ["milestone/*"]), false);
  assertEquals(matchesBranchFilter("Develop", []), false);
});
