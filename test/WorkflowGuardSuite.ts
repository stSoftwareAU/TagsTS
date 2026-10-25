// Registers the workflow guard suites (issues #72 and #104) as dependencies.
// WorkflowGuardRegression_test.ts checks their failure behavior with invalid
// workflows and known faulty helpers; importing alone cannot check that.
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
