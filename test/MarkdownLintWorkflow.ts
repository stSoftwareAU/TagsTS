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

// Issue #76: denoland/setup-deno runs with no cache in markdown-lint.yml, so
// it re-downloads the Deno module cache on every run. The workflow must
// cache ~/.cache/deno on an exact key (Deno version plus deno.json hash, no
// restore-keys) rather than relying on setup-deno's built-in broad-prefix
// cache fallback.
// deno-lint-ignore no-explicit-any
function denoCacheProblems(steps: Array<Record<string, any>>): string[] {
  const problems: string[] = [];

  const setupDenoIndex = steps.findIndex((s) =>
    typeof s.uses === "string" && s.uses.startsWith("denoland/setup-deno@")
  );
  if (setupDenoIndex === -1) {
    problems.push("no denoland/setup-deno step found");
    return problems;
  }
  const setupDeno = steps[setupDenoIndex];

  if (setupDeno.id !== "setup-deno") {
    problems.push("setup-deno step must have id: setup-deno");
  }
  const setupDenoCache = setupDeno.with?.cache;
  if (setupDenoCache === true || setupDenoCache === "true") {
    problems.push(
      "setup-deno step must not enable its own built-in cache",
    );
  }

  const mermaidIndex = steps.findIndex((s) =>
    typeof s.run === "string" && s.run.includes("check-mermaid")
  );

  const cacheSteps = steps.filter((s) =>
    typeof s.uses === "string" && s.uses.startsWith("actions/cache@")
  );
  if (cacheSteps.length !== 1) {
    problems.push(
      `expected exactly one actions/cache step, found ${cacheSteps.length}`,
    );
    return problems;
  }
  const cacheStep = cacheSteps[0];
  const cacheIndex = steps.indexOf(cacheStep);

  if (cacheIndex <= setupDenoIndex) {
    problems.push("cache step must come after the setup-deno step");
  }
  if (mermaidIndex !== -1 && cacheIndex >= mermaidIndex) {
    problems.push(
      "cache step must come before the check-mermaid step",
    );
  }

  if (cacheStep.if !== setupDeno.if) {
    problems.push(
      "cache step's if condition must match the setup-deno step's if condition",
    );
  }

  const path = cacheStep.with?.path;
  if (path !== "~/.cache/deno") {
    problems.push(`cache step's with.path must be ~/.cache/deno, got ${path}`);
  }

  const key = cacheStep.with?.key;
  if (
    typeof key !== "string" ||
    !key.includes("steps.setup-deno.outputs.deno-version")
  ) {
    problems.push(
      "cache step's with.key must include steps.setup-deno.outputs.deno-version",
    );
  }
  if (typeof key !== "string" || !key.includes("hashFiles('deno.json')")) {
    problems.push("cache step's with.key must include hashFiles('deno.json')");
  }
  if (typeof key !== "string" || !key.includes("runner.os")) {
    problems.push("cache step's with.key must include runner.os");
  }

  if (cacheStep.with?.["restore-keys"] !== undefined) {
    problems.push("cache step must not define restore-keys");
  }

  return problems;
}

Deno.test("markdown-lint workflow caches the Deno directory on an exact key", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.markdownlint.steps;
  assertEquals(denoCacheProblems(steps), []);
});

function validDenoCacheSteps(): Array<Record<string, unknown>> {
  return [
    {
      if: "steps.detect-deno.outputs.present == 'true'",
      id: "setup-deno",
      uses: "denoland/setup-deno@667a34cdef165d8d2b2e98dde39547c9daac7282",
      with: { "deno-version": "v2.x" },
    },
    {
      if: "steps.detect-deno.outputs.present == 'true'",
      name: "Cache Deno dependencies",
      uses: "actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
      with: {
        path: "~/.cache/deno",
        key:
          "deno-${{ runner.os }}-${{ runner.arch }}-${{ steps.setup-deno.outputs.deno-version }}-${{ hashFiles('deno.json') }}",
      },
    },
    {
      if: "steps.detect-deno.outputs.present == 'true'",
      name: "Validate Mermaid blocks",
      run: "deno run --allow-read worker/deno/mod.ts check-mermaid",
    },
  ];
}

Deno.test("denoCacheProblems: valid fixture reports no problems", () => {
  assertEquals(denoCacheProblems(validDenoCacheSteps()), []);
});

Deno.test("denoCacheProblems: flags restore-keys", () => {
  const steps = validDenoCacheSteps();
  // deno-lint-ignore no-explicit-any
  (steps[1].with as any)["restore-keys"] = "deno-${{ runner.os }}-";
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags key missing deno.json hash", () => {
  const steps = validDenoCacheSteps();
  // deno-lint-ignore no-explicit-any
  (steps[1].with as any).key =
    "deno-${{ runner.os }}-${{ steps.setup-deno.outputs.deno-version }}";
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags key missing deno-version output", () => {
  const steps = validDenoCacheSteps();
  // deno-lint-ignore no-explicit-any
  (steps[1].with as any).key =
    "deno-${{ runner.os }}-${{ hashFiles('deno.json') }}";
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags setup-deno's own cache: true", () => {
  const steps = validDenoCacheSteps();
  // deno-lint-ignore no-explicit-any
  (steps[0].with as any).cache = true;
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags missing cache step", () => {
  const steps = validDenoCacheSteps();
  steps.splice(1, 1);
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags cache step missing the if gate", () => {
  const steps = validDenoCacheSteps();
  delete steps[1].if;
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags cache step placed after check-mermaid", () => {
  const steps = validDenoCacheSteps();
  const cacheStep = steps.splice(1, 1)[0];
  steps.push(cacheStep);
  assert(denoCacheProblems(steps).length > 0);
});

Deno.test("denoCacheProblems: flags no denoland/setup-deno step at all", () => {
  const steps = validDenoCacheSteps();
  steps.splice(0, 1);
  assert(
    denoCacheProblems(steps).includes("no denoland/setup-deno step found"),
  );
});

Deno.test("denoCacheProblems: flags cache step placed before the setup-deno step", () => {
  const steps = validDenoCacheSteps();
  const cacheStep = steps.splice(1, 1)[0];
  steps.unshift(cacheStep);
  assert(
    denoCacheProblems(steps).includes(
      "cache step must come after the setup-deno step",
    ),
  );
});

Deno.test("denoCacheProblems: flags a cache path other than ~/.cache/deno", () => {
  const steps = validDenoCacheSteps();
  // deno-lint-ignore no-explicit-any
  (steps[1].with as any).path = "~/.deno";
  assert(
    denoCacheProblems(steps).includes(
      "cache step's with.path must be ~/.cache/deno, got ~/.deno",
    ),
  );
});

Deno.test("denoCacheProblems: flags a key missing runner.os", () => {
  const steps = validDenoCacheSteps();
  // deno-lint-ignore no-explicit-any
  (steps[1].with as any).key =
    "deno-${{ steps.setup-deno.outputs.deno-version }}-${{ hashFiles('deno.json') }}";
  assert(
    denoCacheProblems(steps).includes(
      "cache step's with.key must include runner.os",
    ),
  );
});
