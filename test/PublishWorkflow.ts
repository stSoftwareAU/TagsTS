// Verifies the JSR publish job, which holds an OIDC id-token, executes only
// pinned tooling: no registry-latest package runner (`npx jsr publish`) and an
// exact Deno version (CWE-494). Tracked in issue #40.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/publish.yml";
const RUNNER =
  /(?:^|[\s;&|(])(npx|pnpx|bunx|(?:pnpm|yarn) dlx)\s+([^\n;&|)]*)/g;
const EXACT_PACKAGE = /^(?:@[\w.-]+\/)?[\w.-]+@\d+\.\d+\.\d+(?:-[\w.]+)?$/;
const EXACT_DENO = /^v?\d+\.\d+\.\d+$/;

/** Package-runner invocations in a script whose package lacks an exact version. */
export function unpinnedRunners(script: string): string[] {
  const found: string[] = [];
  for (const [, runner, rest] of script.matchAll(RUNNER)) {
    const pkg = rest.trim().split(/\s+/).find((arg) => !arg.startsWith("-"));
    if (!pkg || !EXACT_PACKAGE.test(pkg)) {
      found.push(`${runner} ${rest.trim()}`);
    }
  }
  return found;
}

// deno-lint-ignore no-explicit-any
async function publishSteps(): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const doc = parse(await Deno.readTextFile(WORKFLOW_PATH)) as any;
  return doc?.jobs?.publish?.steps ?? [];
}

Deno.test("unpinnedRunners flags package runners without an exact version", () => {
  assertEquals(unpinnedRunners("npx jsr publish"), ["npx jsr publish"]);
  assertEquals(unpinnedRunners("npx -y jsr@latest publish").length, 1);
  assertEquals(unpinnedRunners("npx jsr@^0.13.0 publish").length, 1);
  assertEquals(unpinnedRunners("set -e && bunx jsr publish").length, 1);
  assertEquals(unpinnedRunners("pnpm dlx @scope/tool run").length, 1);
});

Deno.test("unpinnedRunners accepts exact pins and scripts without a runner", () => {
  assertEquals(unpinnedRunners("npx jsr@0.13.5 publish"), []);
  assertEquals(unpinnedRunners("npx --yes @scope/tool@1.2.3-rc.1"), []);
  assertEquals(unpinnedRunners("deno publish"), []);
  assertEquals(unpinnedRunners(""), []);
});

Deno.test("publish job runs no unpinned package runner", async () => {
  const scripts = (await publishSteps())
    .map((step) => (typeof step.run === "string" ? step.run : ""))
    .filter((run) => run !== "");
  assert(
    scripts.length > 0,
    "publish job has no run steps; the scan is vacuous",
  );
  assertEquals(scripts.flatMap(unpinnedRunners), []);
});

Deno.test("publish job installs an exact Deno version before publishing", async () => {
  const steps = await publishSteps();
  const setup = steps.find((step) =>
    typeof step.uses === "string" &&
    step.uses.startsWith("denoland/setup-deno@")
  );
  assert(setup, "publish job must set up Deno with denoland/setup-deno");
  const version = String(setup.with?.["deno-version"] ?? "");
  assert(
    EXACT_DENO.test(version),
    `deno-version '${version}' must be an exact release`,
  );
  assert(
    steps.some((step) =>
      typeof step.run === "string" && /\bdeno publish\b/.test(step.run)
    ),
    "publish job must publish with `deno publish`",
  );
});
