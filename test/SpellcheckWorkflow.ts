// Verifies the spellcheck workflow runs with a least-privilege GITHUB_TOKEN
// rather than the repository's broad default scopes (issue #59), and that its
// cspell-action step is pinned to a commit SHA on a node24 release (issue #104).
import { assert, assertEquals, assertMatch } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/spellcheck.yaml";
// YAML parsing drops comments, so the trailing `# vX.Y.Z` version comment is
// read from the raw text. Captures the major version of the pinned release.
const CSPELL_VERSION_COMMENT =
  /uses:[ \t]*streetsidesoftware\/cspell-action@[0-9a-f]{40}[ \t]+#[ \t]*v(\d+)\.\d+\.\d+/;

// deno-lint-ignore no-explicit-any
async function loadWorkflow(): Promise<any> {
  return parse(await Deno.readTextFile(WORKFLOW_PATH));
}

// deno-lint-ignore no-explicit-any
function cspellStep(doc: any): any {
  const steps: Array<Record<string, unknown>> = doc.jobs.spellcheck.steps;
  return steps.find((s) =>
    typeof s.uses === "string" &&
    s.uses.startsWith("streetsidesoftware/cspell-action@")
  );
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

Deno.test("spellcheck job runs cspell-action pinned to a commit SHA", async () => {
  const step = cspellStep(await loadWorkflow());
  assert(step, "job must run cspell-action");
  assertMatch(step.uses, /^streetsidesoftware\/cspell-action@[0-9a-f]{40}$/);
});

Deno.test("spellcheck cspell-action version comment names major version 8 or later", async () => {
  const match = CSPELL_VERSION_COMMENT.exec(
    await Deno.readTextFile(WORKFLOW_PATH),
  );
  assert(
    match,
    "cspell-action uses: line must end with a `# vX.Y.Z` version comment",
  );
  const major = Number(match[1]);
  assert(
    major >= 8,
    `cspell-action must be v8.0.0 or later (first node24 release), found v${major}`,
  );
});

Deno.test("spellcheck cspell-action step keeps its files and config inputs", async () => {
  const step = cspellStep(await loadWorkflow());
  assert(step, "job must run cspell-action");
  assertEquals(step.with?.files, "**/*.{md,html,js,ts,css}");
  assertEquals(step.with?.config, ".github/workflows/cspell.json");
});
