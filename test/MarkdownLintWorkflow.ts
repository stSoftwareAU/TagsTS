// Verifies the Markdown Lint GitHub Actions workflow file exists and is
// well-formed YAML. Tracked in issue #19.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/markdown-lint.yml";

Deno.test("markdown-lint workflow file exists", async () => {
  const stat = await Deno.stat(WORKFLOW_PATH);
  assert(stat.isFile, `${WORKFLOW_PATH} should be a regular file`);
});

Deno.test("markdown-lint workflow parses as YAML and defines markdownlint job", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;

  assertEquals(doc.name, "Markdown Lint");
  assert(doc.jobs?.markdownlint, "jobs.markdownlint must be defined");
  assertEquals(doc.jobs.markdownlint["runs-on"], "ubuntu-latest");

  const steps = doc.jobs.markdownlint.steps as Array<Record<string, unknown>>;
  assert(
    Array.isArray(steps) && steps.length > 0,
    "steps must be a non-empty array",
  );

  const runs = steps
    .map((s) => (typeof s.run === "string" ? s.run : ""))
    .join("\n");
  assert(
    runs.includes("markdownlint-cli2"),
    "workflow must invoke markdownlint-cli2",
  );
});

// Issue #27: GitHub deprecated Node.js 20 actions. The workflow must pin
// to action versions that ship with the Node 24 runtime.
Deno.test("markdown-lint workflow does not use deprecated Node 20 action SHAs", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);

  // actions/checkout v4 — Node 20
  assert(
    !text.includes("34e114876b0b11c390a56381ad16ebd13914f8d5"),
    "actions/checkout v4 (Node 20) SHA must not be used; upgrade to v5",
  );
  // actions/setup-node v4 — Node 20
  assert(
    !text.includes("49933ea5288caeca8642d1e84afbd3f7d6820020"),
    "actions/setup-node v4 (Node 20) SHA must not be used; upgrade to v5",
  );
});

Deno.test("markdown-lint workflow pins actions/checkout and actions/setup-node to Node 24 SHAs", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);

  // actions/checkout@v5 (Node 24)
  assert(
    text.includes(
      "actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd",
    ),
    "expected actions/checkout pinned to v5 SHA 93cb6efe...",
  );
  // actions/setup-node@v5 (Node 24)
  assert(
    text.includes(
      "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444",
    ),
    "expected actions/setup-node pinned to v5 SHA a0853c24...",
  );
});

// deno-lint-ignore no-explicit-any
async function loadWorkflow(): Promise<any> {
  return parse(await Deno.readTextFile(WORKFLOW_PATH));
}

// Issue #60: lint gates pull requests only, and follows the fleet workflow checks.
Deno.test("markdown-lint workflow runs on pull requests, not default-branch pushes", async () => {
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

Deno.test("markdown-lint workflow keeps a manual workflow_dispatch trigger", async () => {
  const doc = await loadWorkflow();
  assert("workflow_dispatch" in doc.on);
});

Deno.test("markdown-lint workflow and job hold read-only contents permission", async () => {
  const doc = await loadWorkflow();
  assertEquals(doc.permissions, { contents: "read" });
  assertEquals(doc.jobs?.markdownlint?.permissions, { contents: "read" });
});

Deno.test("markdown-lint job checks out without persisted credentials", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.markdownlint.steps;
  const checkout = steps.find((s) =>
    typeof s.uses === "string" && s.uses.startsWith("actions/checkout@")
  );
  assert(checkout, "job must check out the repository");
  // deno-lint-ignore no-explicit-any
  assertEquals((checkout.with as any)?.["persist-credentials"], false);
});

Deno.test("markdown-lint job installs a pinned markdownlint-cli2", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.markdownlint.steps;
  const install = steps.find((s) =>
    typeof s.run === "string" && s.run.includes("npm install")
  );
  assert(install, "a step must install markdownlint-cli2 via npm install");
  assert(
    /\bmarkdownlint-cli2@\d+\.\d+\.\d+\b/.test(install.run as string),
    "markdownlint-cli2 must be pinned to an exact version",
  );
});
