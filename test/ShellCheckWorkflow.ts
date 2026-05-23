// Verifies the ShellCheck GitHub Actions workflow file exists and is
// well-formed YAML. Tracked in issue #20.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/shellcheck.yml";

Deno.test("shellcheck workflow file exists", async () => {
  const stat = await Deno.stat(WORKFLOW_PATH);
  assert(stat.isFile, `${WORKFLOW_PATH} should be a regular file`);
});

Deno.test("shellcheck workflow parses as YAML and defines shellcheck job", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;

  assertEquals(doc.name, "ShellCheck");
  assert(doc.jobs?.shellcheck, "jobs.shellcheck must be defined");
  assertEquals(doc.jobs.shellcheck["runs-on"], "ubuntu-latest");

  const steps = doc.jobs.shellcheck.steps as Array<Record<string, unknown>>;
  assert(
    Array.isArray(steps) && steps.length > 0,
    "steps must be a non-empty array",
  );

  const usesValues = steps
    .map((s) => (typeof s.uses === "string" ? s.uses : ""))
    .join("\n");
  assert(
    usesValues.includes("ludeeus/action-shellcheck"),
    "workflow must invoke ludeeus/action-shellcheck",
  );
});

Deno.test("shellcheck workflow pins third-party actions to commit SHAs", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;
  const steps = doc.jobs.shellcheck.steps as Array<Record<string, unknown>>;

  for (const step of steps) {
    const uses = typeof step.uses === "string" ? step.uses : "";
    if (!uses) continue;
    const ref = uses.split("@")[1] ?? "";
    assert(
      /^[0-9a-f]{40}$/.test(ref),
      `step uses '${uses}' must be pinned to a 40-char commit SHA, not a tag/branch`,
    );
  }
});
