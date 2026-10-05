// Verifies every CI workflow job sets a job-level `timeout-minutes` so a
// hung step fails fast instead of holding a runner for GitHub's 360-minute
// default. Tracked in issue #75.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_DIR = ".github/workflows";

export const MAX_TIMEOUT_MINUTES = 60;

/** Names of jobs in `doc.jobs` that lack a sane `timeout-minutes`. */
export function jobsWithoutTimeout(doc: unknown): string[] {
  // deno-lint-ignore no-explicit-any
  const jobs = (doc as any)?.jobs ?? {};
  const names: string[] = [];
  for (const [name, job] of Object.entries(jobs as Record<string, unknown>)) {
    // deno-lint-ignore no-explicit-any
    const timeout = (job as any)?.["timeout-minutes"];
    const isValid = Number.isInteger(timeout) &&
      timeout > 0 &&
      timeout <= MAX_TIMEOUT_MINUTES;
    if (!isValid) names.push(name);
  }
  return names;
}

async function workflowFiles(): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(WORKFLOW_DIR)) {
    if (entry.isFile && /\.ya?ml$/.test(entry.name)) {
      files.push(`${WORKFLOW_DIR}/${entry.name}`);
    }
  }
  return files.sort();
}

Deno.test("jobsWithoutTimeout accepts valid timeouts", () => {
  const doc = {
    jobs: {
      quick: { "timeout-minutes": 10 },
      limit: { "timeout-minutes": 60 },
    },
  };
  assertEquals(jobsWithoutTimeout(doc), []);
});

Deno.test("jobsWithoutTimeout reports a job missing timeout-minutes", () => {
  const yaml = `
jobs:
  withTimeout:
    timeout-minutes: 10
  withoutTimeout:
    steps: []
`;
  const doc = parse(yaml);
  assertEquals(jobsWithoutTimeout(doc), ["withoutTimeout"]);
});

Deno.test("jobsWithoutTimeout rejects invalid timeout values", () => {
  const invalidValues = [0, -5, 61, 360, 2.5, "10"];
  for (const value of invalidValues) {
    const doc = {
      jobs: {
        invalid: { "timeout-minutes": value },
        valid: { "timeout-minutes": 10 },
      },
    };
    assertEquals(
      jobsWithoutTimeout(doc),
      ["invalid"],
      `expected timeout-minutes of ${JSON.stringify(value)} to be rejected`,
    );

    const fixed = {
      jobs: {
        invalid: { "timeout-minutes": 10 },
        valid: { "timeout-minutes": 10 },
      },
    };
    assertEquals(
      jobsWithoutTimeout(fixed),
      [],
      "job should be accepted once given a legal timeout-minutes value",
    );
  }
});

Deno.test("every workflow job sets timeout-minutes", async () => {
  const files = await workflowFiles();
  assert(files.length > 0, `no workflows found in ${WORKFLOW_DIR}`);

  let checked = 0;
  const offenders: string[] = [];
  for (const file of files) {
    const doc = parse(await Deno.readTextFile(file));
    // deno-lint-ignore no-explicit-any
    const jobs = (doc as any)?.jobs ?? {};
    checked += Object.keys(jobs).length;
    for (const job of jobsWithoutTimeout(doc)) {
      offenders.push(`${file}: ${job}`);
    }
  }

  assert(checked > 0, "no jobs found; the scan is vacuous");
  assertEquals(
    offenders,
    [],
    "every job must set a job-level timeout-minutes (<= 60)",
  );
});
