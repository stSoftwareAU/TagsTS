// Verifies the actionlint CI gate that fails pull requests carrying workflow
// regressions. Tracked in issue #58.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/actionlint.yml";
const ACTIONLINT_IMAGE = /^docker:\/\/rhysd\/actionlint@sha256:[0-9a-f]{64}$/;

// deno-lint-ignore no-explicit-any
async function loadWorkflow(): Promise<any> {
  return parse(await Deno.readTextFile(WORKFLOW_PATH));
}

Deno.test("actionlint workflow runs on pull requests, not default-branch pushes", async () => {
  const doc = await loadWorkflow();
  assert(doc.on?.pull_request !== undefined, "must trigger on pull_request");
  assertEquals(doc.on.push, undefined, "must not trigger on push");

  const branches = doc.on.pull_request?.branches;
  if (branches !== undefined) {
    assert(
      branches.includes("milestone/**") || branches.includes("**"),
      "a pull_request branch filter must also match milestone/**",
    );
  }
});

Deno.test("actionlint workflow and job hold read-only contents permission", async () => {
  const doc = await loadWorkflow();
  assertEquals(doc.permissions, { contents: "read" });
  assertEquals(doc.jobs?.actionlint?.permissions, { contents: "read" });
});

Deno.test("actionlint job checks out without persisted credentials", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.actionlint.steps;
  const checkout = steps.find((s) =>
    typeof s.uses === "string" && s.uses.startsWith("actions/checkout@")
  );
  assert(checkout, "job must check out the repository");
  // deno-lint-ignore no-explicit-any
  assertEquals((checkout.with as any)?.["persist-credentials"], false);
});

Deno.test("actionlint job runs the digest-pinned rhysd/actionlint image", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.actionlint.steps;
  const lint = steps.find((s) =>
    typeof s.uses === "string" && ACTIONLINT_IMAGE.test(s.uses)
  );
  assert(lint, "a step must use docker://rhysd/actionlint@sha256:<digest>");
  // deno-lint-ignore no-explicit-any
  assertEquals((lint.with as any)?.args, "-color");
});
