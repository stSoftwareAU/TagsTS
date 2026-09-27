// Verifies every GitHub Action and reusable workflow referenced by the CI
// workflows is pinned to an immutable 40-character commit SHA rather than a
// mutable tag or branch (CWE-494). Tracked in issue #39.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_DIR = ".github/workflows";
const SHA_PIN = /@[0-9a-f]{40}$/;

/** True when a `uses:` value is local, a docker image, or pinned to a SHA. */
export function isPinned(uses: string): boolean {
  if (uses.startsWith("./") || uses.startsWith("docker://")) return true;
  return SHA_PIN.test(uses);
}

/** Every `uses:` reference (step-level and job-level) in a parsed workflow. */
function usesRefs(doc: unknown): string[] {
  // deno-lint-ignore no-explicit-any
  const jobs = Object.values((doc as any)?.jobs ?? {}) as any[];
  return jobs.flatMap((job) => [
    ...(typeof job?.uses === "string" ? [job.uses] : []),
    ...((job?.steps ?? []) as Array<Record<string, unknown>>)
      .map((step) => step.uses)
      .filter((uses): uses is string => typeof uses === "string"),
  ]);
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

Deno.test("isPinned accepts SHA pins, local and docker references", () => {
  assert(isPinned("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"));
  assert(isPinned("github/codeql-action/init@" + "a".repeat(40)));
  assert(isPinned("./.github/actions/local"));
  assert(isPinned("docker://alpine:3.20"));
});

Deno.test("isPinned rejects tags, branches and malformed SHAs", () => {
  assertEquals(isPinned("actions/checkout@v4"), false);
  assertEquals(isPinned("actions/checkout@main"), false);
  assertEquals(isPinned("actions/checkout"), false);
  assertEquals(isPinned("actions/checkout@" + "a".repeat(39)), false);
  assertEquals(isPinned("actions/checkout@" + "A".repeat(40)), false);
  assertEquals(isPinned("actions/checkout@" + "a".repeat(40) + "x"), false);
});

Deno.test("every workflow action is pinned to a commit SHA", async () => {
  const files = await workflowFiles();
  assert(files.length > 0, `no workflows found in ${WORKFLOW_DIR}`);

  let checked = 0;
  const unpinned: string[] = [];
  for (const file of files) {
    for (const uses of usesRefs(parse(await Deno.readTextFile(file)))) {
      checked++;
      if (!isPinned(uses)) unpinned.push(`${file}: ${uses}`);
    }
  }

  assert(checked > 0, "no `uses:` references found; the scan is vacuous");
  assertEquals(unpinned, [], "actions must be pinned to a 40-char commit SHA");
});
