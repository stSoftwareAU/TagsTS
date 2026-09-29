// Verifies the spellcheck workflow runs with a least-privilege GITHUB_TOKEN
// rather than the repository's broad default scopes. Tracked in issue #59.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/spellcheck.yaml";

// deno-lint-ignore no-explicit-any
async function loadWorkflow(): Promise<any> {
  return parse(await Deno.readTextFile(WORKFLOW_PATH));
}

Deno.test("spellcheck workflow and job hold read-only contents permission", async () => {
  const doc = await loadWorkflow();
  assertEquals(doc.permissions, { contents: "read" });
  assertEquals(doc.jobs?.spellcheck?.permissions, { contents: "read" });
});

Deno.test("spellcheck job checks out without persisted credentials", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.spellcheck.steps;
  const checkout = steps.find((s) =>
    typeof s.uses === "string" && s.uses.startsWith("actions/checkout@")
  );
  assert(checkout, "job must check out the repository");
  // deno-lint-ignore no-explicit-any
  assertEquals((checkout.with as any)?.["persist-credentials"], false);
});
