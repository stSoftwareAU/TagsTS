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

// Issue #76: `deno outdated` and `deno test` re-download every module on
// each run because the Deno module cache (DENO_DIR) is never persisted
// between workflow runs. Cache it on an exact key — Deno version plus
// deno.json hash — so a change to either misses cleanly instead of
// restoring a stale (and potentially tampered-with) DENO_DIR.
/**
 * Checks the quality workflow's steps for a correctly configured,
 * exact-match Deno module cache. Returns an empty array when everything is
 * correct, otherwise a list of human-readable problem descriptions.
 */
// deno-lint-ignore no-explicit-any
function denoCacheProblems(steps: Array<Record<string, any>>): string[] {
  const problems: string[] = [];

  const setupDenoIdx = steps.findIndex((step) =>
    typeof step.uses === "string" &&
    step.uses.startsWith("denoland/setup-deno@")
  );
  if (setupDenoIdx === -1) {
    problems.push("no denoland/setup-deno step found");
  } else {
    const setupDeno = steps[setupDenoIdx];
    if (setupDeno.id !== "setup-deno") {
      problems.push("setup-deno step must have id: setup-deno");
    }
    if (setupDeno.with?.cache === true || setupDeno.with?.cache === "true") {
      problems.push(
        "setup-deno step must not use its own cache: true (it always falls back to a stale broad-prefix key)",
      );
    }
  }

  const cacheIndices = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) =>
      typeof step.uses === "string" && step.uses.startsWith("actions/cache@")
    )
    .map(({ index }) => index);

  const outdatedIdx = steps.findIndex((step) =>
    typeof step.run === "string" && step.run.includes("deno outdated")
  );

  if (cacheIndices.length !== 1) {
    problems.push(
      `expected exactly one actions/cache step, found ${cacheIndices.length}`,
    );
    return problems;
  }

  const cacheIdx = cacheIndices[0];
  const cacheStep = steps[cacheIdx];

  if (setupDenoIdx !== -1 && cacheIdx <= setupDenoIdx) {
    problems.push("cache step must come after the setup-deno step");
  }
  if (outdatedIdx !== -1 && cacheIdx >= outdatedIdx) {
    problems.push("cache step must come before the deno outdated step");
  }

  if (cacheStep.with?.path !== "~/.cache/deno") {
    problems.push(
      `cache step 'with.path' must be '~/.cache/deno', got '${cacheStep.with?.path}'`,
    );
  }

  const key = typeof cacheStep.with?.key === "string" ? cacheStep.with.key : "";
  if (!key.includes("steps.setup-deno.outputs.deno-version")) {
    problems.push(
      "cache key must include steps.setup-deno.outputs.deno-version",
    );
  }
  if (!key.includes("hashFiles('deno.json')")) {
    problems.push("cache key must include hashFiles('deno.json')");
  }
  if (!key.includes("runner.os")) {
    problems.push("cache key must include runner.os");
  }

  if (cacheStep.with && "restore-keys" in cacheStep.with) {
    problems.push(
      "cache step must not set restore-keys (it would fall back to a stale entry)",
    );
  }

  return problems;
}

/** A minimal, otherwise-valid steps fixture for denoCacheProblems tests. */
// deno-lint-ignore no-explicit-any
function validCacheFixture(): Array<Record<string, any>> {
  return [
    {
      name: "Setup Deno",
      id: "setup-deno",
      uses: "denoland/setup-deno@667a34cdef165d8d2b2e98dde39547c9daac7282",
    },
    {
      name: "Cache Deno dependencies",
      uses: "actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
      with: {
        path: "~/.cache/deno",
        key:
          "deno-${{ runner.os }}-${{ runner.arch }}-${{ steps.setup-deno.outputs.deno-version }}-${{ hashFiles('deno.json') }}",
      },
    },
    {
      name: "Update Deno",
      run: "deno outdated --update --latest",
    },
  ];
}

Deno.test("quality workflow caches the Deno directory on an exact key", async () => {
  const steps = qualitySteps(await readWorkflow());
  assertEquals(denoCacheProblems(steps), []);
});

Deno.test("quality workflow Deno cache never falls back to a stale entry", async () => {
  const steps = qualitySteps(await readWorkflow());
  const cacheStep = steps.find((step) =>
    typeof step.uses === "string" && step.uses.startsWith("actions/cache@")
  );
  assert(cacheStep, "expected an actions/cache step");
  assertEquals(cacheStep!.with?.["restore-keys"], undefined);

  const setupDeno = steps.find((step) =>
    typeof step.uses === "string" &&
    step.uses.startsWith("denoland/setup-deno@")
  );
  assert(setupDeno, "expected a denoland/setup-deno step");
  const cacheFlag = setupDeno!.with?.cache;
  assert(
    cacheFlag !== true && cacheFlag !== "true",
    "setup-deno step must not enable its own cache: true",
  );
});

Deno.test("denoCacheProblems: valid fixture yields no problems", () => {
  assertEquals(denoCacheProblems(validCacheFixture()), []);
});

Deno.test("denoCacheProblems: flags a cache step with restore-keys present", () => {
  const steps = validCacheFixture();
  steps[1].with["restore-keys"] = "deno-";
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags a key missing hashFiles('deno.json')", () => {
  const steps = validCacheFixture();
  steps[1].with.key =
    "deno-${{ runner.os }}-${{ runner.arch }}-${{ steps.setup-deno.outputs.deno-version }}";
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags a key missing the deno-version output", () => {
  const steps = validCacheFixture();
  steps[1].with.key =
    "deno-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('deno.json') }}";
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags setup-deno with cache: true", () => {
  const steps = validCacheFixture();
  steps[0].with = { cache: true };
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags no cache step at all", () => {
  const steps = validCacheFixture();
  steps.splice(1, 1);
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags cache step placed after deno outdated", () => {
  const steps = validCacheFixture();
  const [cacheStep] = steps.splice(1, 1);
  steps.push(cacheStep);
  assert(denoCacheProblems(steps).length > 0);
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
