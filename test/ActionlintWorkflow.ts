// Verifies the actionlint CI gate that fails pull requests carrying workflow
// regressions. Tracked in issue #58.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/actionlint.yml";
// The repo's Actions allowlist rejects `docker://` action references (they can
// never be pinned to a commit SHA), so the image runs from a `run:` step.
const ACTIONLINT_IMAGE = /\brhysd\/actionlint@sha256:[0-9a-f]{64}(\s|$)/;

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

Deno.test("actionlint job uses no docker:// action, which the Actions allowlist rejects", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.actionlint.steps;
  for (const step of steps) {
    assert(
      !(typeof step.uses === "string" && step.uses.startsWith("docker://")),
      `step "${step.name ?? step.uses}" must not use a docker:// action`,
    );
  }
});

Deno.test("actionlint job runs the digest-pinned rhysd/actionlint image", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.actionlint.steps;
  const lint = steps.find((s) =>
    typeof s.run === "string" && ACTIONLINT_IMAGE.test(s.run)
  );
  assert(
    lint,
    "a run: step must docker run rhysd/actionlint@sha256:<digest>",
  );
  const run = lint.run as string;
  assert(/\bdocker run\b/.test(run), "the step must use docker run");
  assert(
    run.includes('"$GITHUB_WORKSPACE:/repo"') && /-w \/repo\b/.test(run),
    "the checkout must be mounted and used as the working directory",
  );
  assert(/(^|\s)-color(\s|$)/.test(run), "actionlint must run with -color");
});
