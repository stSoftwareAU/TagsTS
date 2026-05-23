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
