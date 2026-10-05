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

// Issue #62: the checkout must not write GITHUB_TOKEN into .git/config,
// where the later `semgrep ci` step (which holds SEMGREP_APP_TOKEN) could
// read it. No step in this job pushes, so the credential is never needed.
Deno.test("semgrep workflow checks out without persisted credentials", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;
  const steps = doc.jobs.semgrep.steps as Array<Record<string, unknown>>;
  const checkouts = steps.filter((s) =>
    typeof s.uses === "string" && s.uses.startsWith("actions/checkout@")
  );
  assert(checkouts.length > 0, "semgrep job must check out the repository");
  for (const checkout of checkouts) {
    assertEquals(
      // deno-lint-ignore no-explicit-any
      (checkout.with as any)?.["persist-credentials"],
      false,
      "actions/checkout must set persist-credentials: false",
    );
  }
});

// Issue #67: GitHub's `*` glob does not match `/`, so a branch filter of ["*"] skips PRs into milestone/<slug>.
function filterMatchesMilestone(branches: unknown): boolean {
  if (branches === undefined) return true;
  return Array.isArray(branches) &&
    (branches.includes("**") || branches.includes("milestone/**"));
}

Deno.test("semgrep pull_request branch filter matches milestone/** branches", async () => {
  const text = await Deno.readTextFile(WORKFLOW_PATH);
  // deno-lint-ignore no-explicit-any
  const doc = parse(text) as any;

  assert(doc.on?.pull_request, "workflow must still run on pull requests");
  assert(
    filterMatchesMilestone(doc.on?.pull_request?.branches),
    "a pull_request branch filter must also match milestone/**",
  );
});

Deno.test("milestone filter guard rejects filters that skip milestone branches", () => {
  assertEquals(filterMatchesMilestone(["*"]), false);
  assertEquals(filterMatchesMilestone(["Develop", "main"]), false);
  assertEquals(filterMatchesMilestone(["milestone/*"]), false);
  assertEquals(filterMatchesMilestone("**"), false);

  assertEquals(filterMatchesMilestone(["**"]), true);
  assertEquals(
    filterMatchesMilestone(["Develop", "main", "milestone/**"]),
    true,
  );
  assertEquals(filterMatchesMilestone(undefined), true);
});
