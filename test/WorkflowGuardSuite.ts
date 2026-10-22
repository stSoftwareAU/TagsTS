// Re-runs the workflow guard suites (issues #72 and #104) through a module that
// imports them, so their assertions are exercised by an importing test and a
// change to a guard line turns a test red. Importing a test module registers
// its tests in this module as well.
import { assert, assertEquals } from "@std/assert";
import {
  isPinned,
  NODE20_ACTION_SHAS,
  usesNode20Action,
} from "./ActionPins.ts";
import "./SpellcheckWorkflow.ts";

Deno.test("guarded actions include checkout and cspell-action", () => {
  assertEquals(
    [...NODE20_ACTION_SHAS.keys()].sort(),
    ["actions/checkout", "streetsidesoftware/cspell-action"],
  );
  for (const [action, shas] of NODE20_ACTION_SHAS) {
    for (const sha of shas.keys()) {
      assert(isPinned(`${action}@${sha}`));
      assert(usesNode20Action(`${action}@${sha}`));
    }
  }
});
