// Verifies the Semgrep GitHub Actions workflow file exists and is
// well-formed YAML. Tracked in issue #18.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/semgrep.yml";

Deno.test("semgrep workflow file exists", async () => {
  const stat = await Deno.stat(WORKFLOW_PATH);
  assert(stat.isFile, `${WORKFLOW_PATH} should be a regular file`);
});

Deno.test("semgrep workflow parses as YAML and defines semgrep job", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;

  assertEquals(doc.name, "Semgrep");
  assert(doc.jobs?.semgrep, "jobs.semgrep must be defined");
  assertEquals(doc.jobs.semgrep["runs-on"], "ubuntu-latest");

  const image = doc.jobs.semgrep.container?.image as string;
  assert(
    image.startsWith("semgrep/semgrep@sha256:"),
    "container image must be pinned to a digest",
  );

  const steps = doc.jobs.semgrep.steps as Array<Record<string, unknown>>;
  assert(
    Array.isArray(steps) && steps.length > 0,
    "steps must be a non-empty array",
  );

  const runs = steps
    .map((s) => (typeof s.run === "string" ? s.run : ""))
    .join("\n");
  assert(
    runs.includes("semgrep ci"),
    "workflow must invoke semgrep ci",
  );
});

Deno.test("semgrep workflow pins third-party actions to commit SHAs", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;
  const steps = doc.jobs.semgrep.steps as Array<Record<string, unknown>>;

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
