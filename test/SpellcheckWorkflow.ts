// Verifies the spellcheck workflow runs with a least-privilege GITHUB_TOKEN
// rather than the repository's broad default scopes (issue #59), and that its
// cspell-action step is pinned to a commit SHA on a node24 release (issue #104).
import {
  assert,
  assertEquals,
  AssertionError,
  assertMatch,
  assertThrows,
} from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_PATH = ".github/workflows/spellcheck.yaml";
// YAML parsing drops comments, so the trailing `# vX.Y.Z` version comment is
// read from the raw text. Captures the major version of the pinned release.
const CSPELL_VERSION_COMMENT =
  /uses:[ \t]*streetsidesoftware\/cspell-action@[0-9a-f]{40}[ \t]+#[ \t]*v(\d+)\.\d+\.\d+/;

// deno-lint-ignore no-explicit-any
async function loadWorkflow(): Promise<any> {
  return parse(await Deno.readTextFile(WORKFLOW_PATH));
}

// deno-lint-ignore no-explicit-any
function cspellStep(doc: any): any {
  const steps: Array<Record<string, unknown>> = doc.jobs.spellcheck.steps;
  return steps.find((s) =>
    typeof s.uses === "string" &&
    s.uses.startsWith("streetsidesoftware/cspell-action@")
  );
}

Deno.test("spellcheck workflow and job hold read-only contents permission", async () => {
  const doc = await loadWorkflow();
  assertEquals(doc.permissions, { contents: "read" });
  assertEquals(doc.jobs?.spellcheck?.permissions, { contents: "read" });
});

Deno.test("spellcheck job checks out without persisted credentials", async () => {
  const doc = await loadWorkflow();
  const steps: Array<Record<string, unknown>> = doc.jobs.spellcheck.steps;
  const checkout = steps.find((s) =>
    typeof s.uses === "string" && s.uses.startsWith("actions/checkout@")
  );
  assert(checkout, "job must check out the repository");
  // deno-lint-ignore no-explicit-any
  assertEquals((checkout.with as any)?.["persist-credentials"], false);
});

// deno-lint-ignore no-explicit-any
function checkCspellPinnedToSha(doc: any): void {
  const step = cspellStep(doc);
  assert(step, "job must run cspell-action");
  assertMatch(step.uses, /^streetsidesoftware\/cspell-action@[0-9a-f]{40}$/);
}

// deno-lint-ignore no-explicit-any
function checkCspellInputs(doc: any): void {
  const step = cspellStep(doc);
  assert(step, "job must run cspell-action");
  assert(step.with, "cspell-action must configure inputs");
  assertEquals(
    step.with?.files,
    "**/*.{md,html,js,ts,css}",
    "cspell files input must be preserved",
  );
  assertEquals(
    step.with?.config,
    ".github/workflows/cspell.json",
    "cspell config input must be preserved",
  );
}

function docWithCspellStep(step?: Record<string, unknown>) {
  return {
    jobs: {
      spellcheck: {
        steps: [
          { run: "echo checking spelling" },
          { uses: "actions/checkout@" + "a".repeat(40) },
          ...(step ? [step] : []),
        ],
      },
    },
  };
}

const CSPELL_SHA_USES = "streetsidesoftware/cspell-action@" + "b".repeat(40);
const CSPELL_INPUTS = {
  files: "**/*.{md,html,js,ts,css}",
  config: ".github/workflows/cspell.json",
};

Deno.test("spellcheck job runs cspell-action pinned to a commit SHA", async () => {
  checkCspellPinnedToSha(await loadWorkflow());
});

Deno.test("cspell pin check rejects a missing step and tag or branch refs", () => {
  assertThrows(
    () => checkCspellPinnedToSha(docWithCspellStep()),
    Error,
    "job must run cspell-action",
  );
  for (const ref of ["v9", "main", "b".repeat(39)]) {
    assertThrows(() =>
      checkCspellPinnedToSha(
        docWithCspellStep({ uses: `streetsidesoftware/cspell-action@${ref}` }),
      )
    );
  }
  checkCspellPinnedToSha(docWithCspellStep({ uses: CSPELL_SHA_USES }));
});

Deno.test("spellcheck cspell-action version comment names major version 8 or later", async () => {
  const match = CSPELL_VERSION_COMMENT.exec(
    await Deno.readTextFile(WORKFLOW_PATH),
  );
  assert(
    match,
    "cspell-action uses: line must end with a `# vX.Y.Z` version comment",
  );
  const major = Number(match[1]);
  assert(
    major >= 8,
    `cspell-action must be v8.0.0 or later (first node24 release), found v${major}`,
  );
});

Deno.test("spellcheck cspell-action step keeps its files and config inputs", async () => {
  checkCspellInputs(await loadWorkflow());
});

Deno.test("cspell inputs check rejects a missing step and changed inputs", () => {
  assertThrows(
    () => checkCspellInputs(docWithCspellStep()),
    Error,
    "job must run cspell-action",
  );
  assertThrows(
    () => checkCspellInputs(docWithCspellStep({ uses: CSPELL_SHA_USES })),
    AssertionError,
    "cspell-action must configure inputs",
  );
  assertThrows(
    () =>
      checkCspellInputs(
        docWithCspellStep({
          uses: CSPELL_SHA_USES,
          with: { ...CSPELL_INPUTS, files: "**/*.md" },
        }),
      ),
    AssertionError,
    "cspell files input must be preserved",
  );
  assertThrows(
    () =>
      checkCspellInputs(
        docWithCspellStep({
          uses: CSPELL_SHA_USES,
          with: { ...CSPELL_INPUTS, config: "other.json" },
        }),
      ),
    AssertionError,
    "cspell config input must be preserved",
  );
  checkCspellInputs(
    docWithCspellStep({ uses: CSPELL_SHA_USES, with: CSPELL_INPUTS }),
  );
});
