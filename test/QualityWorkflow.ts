// Verifies the supply-chain quarantine gate guarding the unattended
// `deno outdated --update --latest` step in the quality workflow, so a
// dependency version published moments ago can never be adopted, executed
// and auto-pushed without ageing first. Tracked in issue #36.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/quality.yml";
const CONFIG_PATH = "deno.json";

/** Minimum quarantine window, in hours, the repository must enforce. */
const MINIMUM_AGE_HOURS = 24;

// deno-lint-ignore no-explicit-any
async function readWorkflow(): Promise<any> {
  return parse(await Deno.readTextFile(WORKFLOW_PATH));
}

// deno-lint-ignore no-explicit-any
async function readConfig(): Promise<any> {
  return JSON.parse(await Deno.readTextFile(CONFIG_PATH));
}

/** Every `run:` script in the workflow, joined for whole-file inspection. */
function runScripts(doc: unknown): string {
  // deno-lint-ignore no-explicit-any
  const jobs = (doc as any)?.jobs ?? {};
  return Object.values(jobs)
    // deno-lint-ignore no-explicit-any
    .flatMap((job: any) => (job?.steps ?? []) as Array<Record<string, unknown>>)
    .map((step) => (typeof step.run === "string" ? step.run : ""))
    .join("\n");
}

/**
 * Converts the subset of ISO-8601 durations Deno accepts for
 * `minimumDependencyAge` into hours. Returns null when the value is not a
 * plain day/hour/minute duration.
 */
function durationHours(age: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(age);
  if (!match || match.slice(1).every((part) => part === undefined)) return null;
  const [days, hours, minutes] = match.slice(1).map((p) => Number(p ?? 0));
  return days * 24 + hours + minutes / 60;
}

Deno.test("deno.json quarantines external dependencies for at least 24 hours", async () => {
  const config = await readConfig();
  const policy = config.minimumDependencyAge;
  assert(
    policy && typeof policy === "object",
    `${CONFIG_PATH} must declare a "minimumDependencyAge" policy object`,
  );

  const hours = durationHours(policy.age);
  assert(
    hours !== null,
    `minimumDependencyAge.age '${policy.age}' must be an ISO-8601 duration (e.g. P1D)`,
  );
  assert(
    hours >= MINIMUM_AGE_HOURS,
    `minimumDependencyAge.age '${policy.age}' is ${hours}h; at least ${MINIMUM_AGE_HOURS}h is required`,
  );
});

Deno.test("deno.json exempts internal stSoftwareAU scopes from the quarantine wait", async () => {
  const config = await readConfig();
  const exclude = config.minimumDependencyAge?.exclude ?? [];
  assert(Array.isArray(exclude), "minimumDependencyAge.exclude must be a list");
  for (const scope of ["jsr:@stsoftware/*", "npm:@stsoftware/*"]) {
    assert(
      exclude.includes(scope),
      `minimumDependencyAge.exclude must contain '${scope}' so internal dependencies update immediately`,
    );
  }
});

Deno.test("quality workflow never disables the quarantine gate", async () => {
  const doc = await readWorkflow();
  const scripts = runScripts(doc);
  assert(
    scripts.includes("deno outdated"),
    "quality workflow is expected to run deno outdated",
  );

  const flags = scripts.matchAll(
    /--min(?:imum)?-dep(?:endency)?-age[= ]([^\s"']+)/g,
  );
  for (const [flag, value] of flags) {
    const hours = /^\d+$/.test(value)
      ? Number(value) / 60
      : durationHours(value);
    assert(
      hours !== null && hours >= MINIMUM_AGE_HOURS,
      `'${flag}' weakens the quarantine below ${MINIMUM_AGE_HOURS}h`,
    );
  }
  assert(
    !/--no-config|--no-lock/.test(scripts),
    "quality workflow must not bypass deno.json, which carries the quarantine policy",
  );
});

Deno.test("quality workflow pins actions to commit SHAs", async () => {
  const doc = await readWorkflow();
  const steps = doc.jobs.quality.steps as Array<Record<string, unknown>>;
  assert(steps.length > 0, "steps must be a non-empty array");

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

Deno.test("quality workflow declares least-privilege permissions", async () => {
  const doc = await readWorkflow();
  const permissions = doc.permissions ?? doc.jobs.quality.permissions;
  assert(permissions, "quality workflow must declare explicit permissions");
  assertEquals(
    permissions.contents,
    "write",
    "the job pushes formatting fixes, so contents: write is the only scope it needs",
  );
});

// deno-lint-ignore no-explicit-any
function qualitySteps(doc: any): Array<Record<string, any>> {
  return doc.jobs.quality.steps;
}

Deno.test("quality workflow checkout does not persist the push PAT to disk", async () => {
  // Issue #37: a persisted PAT sits in .git/config, readable by the
  // `deno test` step and any dependency it executes.
  const checkouts = qualitySteps(await readWorkflow()).filter((step) =>
    typeof step.uses === "string" && step.uses.startsWith("actions/checkout@")
  );
  assert(checkouts.length > 0, "quality workflow is expected to check out");
  for (const step of checkouts) {
    assertEquals(
      step.with?.["persist-credentials"],
      false,
      `'${step.name}' must set persist-credentials: false`,
    );
  }
});

Deno.test("quality workflow re-introduces the push PAT only at the push step", async () => {
  const steps = qualitySteps(await readWorkflow());
  const pushSteps = steps.filter((step) =>
    typeof step.run === "string" && /\bgit\b[^\n]*\bpush\b/.test(step.run)
  );
  assert(pushSteps.length > 0, "quality workflow is expected to push fixes");

  for (const step of pushSteps) {
    assert(
      step.run.includes("http.https://github.com/.extraheader"),
      `'${step.name}' must authenticate with a per-command extraheader`,
    );
    assert(
      !step.run.includes("${{"),
      `'${step.name}' must read the PAT from env:, not interpolate it into the script`,
    );
    const env = Object.values(step.env ?? {}).join("\n");
    assert(
      env.includes("secrets.ACTIONS_PUSH"),
      `'${step.name}' must receive the PAT through its env: map`,
    );
  }

  // No other run step may see the PAT, least of all the dependency-running tests.
  for (const step of steps) {
    if (pushSteps.includes(step) || typeof step.run !== "string") continue;
    assert(
      !JSON.stringify(step).includes("secrets."),
      `'${step.name}' must not be handed a secret`,
    );
  }
});

/** Permission flags on every `deno test` invocation in the quality job. */
// deno-lint-ignore no-explicit-any
function testStepFlags(steps: Array<Record<string, any>>): string[][] {
  return steps
    .filter((step) => typeof step.run === "string")
    .flatMap((step) =>
      (step.run as string).split("\n").filter((line) =>
        /\bdeno\s+test\b/.test(line)
      )
    )
    .map((line) =>
      line.trim().split(/\s+/).map((token) => token.replace(/["']/g, ""))
        .filter((token) => /^-(A|-allow-)/.test(token))
    );
}

Deno.test("quality workflow runs tests without --allow-all", async () => {
  // Issue #38 hop 2: `deno test --allow-all` hands every freshly updated
  // dependency full access to the runner — network, subprocesses, env.
  const invocations = testStepFlags(qualitySteps(await readWorkflow()));
  assert(invocations.length > 0, "quality workflow is expected to run tests");
  for (const flags of invocations) {
    for (const flag of flags) {
      assert(
        flag !== "-A" && !flag.startsWith("--allow-all"),
        `deno test must not be granted ${flag}`,
      );
      // No network (exfiltration), subprocess (git/curl), env or FFI access.
      assert(
        !/^--allow-(net|run|env|ffi|import)\b/.test(flag),
        `deno test must not be granted ${flag}`,
      );
    }
  }
});

Deno.test("quality workflow confines test writes to a temp directory", async () => {
  // Unscoped --allow-write would let a dependency rewrite tracked files
  // (e.g. .github/workflows/*) that the Commit/Push steps then publish.
  const invocations = testStepFlags(qualitySteps(await readWorkflow()));
  assert(invocations.length > 0, "quality workflow is expected to run tests");
  for (const flags of invocations) {
    assert(
      !flags.some((f) => f === "-A" || f.startsWith("--allow-all")),
      "--allow-all grants unscoped write access",
    );
    for (const flag of flags.filter((f) => f.startsWith("--allow-write"))) {
      const scope = flag.split("=")[1] ?? "";
      assert(scope !== "", `deno test write access must be scoped: ${flag}`);
      for (const path of scope.split(",")) {
        assert(
          path === "$RUNNER_TEMP" || path === "${RUNNER_TEMP}",
          `deno test may only write under $RUNNER_TEMP, not '${path}'`,
        );
      }
    }
  }
});

Deno.test("quality workflow breaks every hop of the issue #38 exploit chain", async () => {
  const [doc, config] = await Promise.all([readWorkflow(), readConfig()]);
  const steps = qualitySteps(doc);
  // Hop 1: fresh releases are quarantined before `deno outdated` adopts them.
  assert(
    config.minimumDependencyAge,
    "deno.json must set minimumDependencyAge",
  );
  // Hop 2: no test invocation runs with full permissions.
  const flags = testStepFlags(steps).flat();
  assert(
    !flags.some((f) => f === "-A" || f.startsWith("--allow-all")),
    "deno test must not run with --allow-all",
  );
  // Hop 3: the push PAT is never persisted to .git/config.
  for (const step of steps) {
    if (
      typeof step.uses === "string" && step.uses.startsWith("actions/checkout@")
    ) {
      assertEquals(step.with?.["persist-credentials"], false);
    }
  }
});
