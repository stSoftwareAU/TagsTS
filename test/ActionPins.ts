// Verifies every GitHub Action and reusable workflow referenced by the CI
// workflows is pinned to an immutable 40-character commit SHA rather than a
// mutable tag or branch (CWE-494). Tracked in issue #39. Also guards against
// actions/checkout releases that run on the deprecated node20 Actions
// runtime, which GitHub removed on 2026-09-16 (issue #72). It also guards
// softprops/action-gh-release releases that run on node20 (issue #106).
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";
import {
  ghReleaseScanProblems,
  NODE20_GH_RELEASE_SHAS,
  readWorkflowTexts,
  scanGhRelease,
  scanGhReleaseFiles,
  usesNode20GhRelease,
  usesRefs,
} from "../tools/GhReleasePins.ts";

const WORKFLOW_DIR = ".github/workflows";
const SHA_PIN = /@[0-9a-f]{40}$/;

/** True when a `uses:` value is local, a docker image, or pinned to a SHA. */
export function isPinned(uses: string): boolean {
  if (uses.startsWith("./") || uses.startsWith("docker://")) return true;
  return SHA_PIN.test(uses);
}

/**
 * actions/checkout commit SHAs whose `action.yml` declares `using: node20`,
 * a runtime GitHub removed on 2026-09-16 (issue #72). Verified with
 * `gh api repos/actions/checkout/commits/<tag> --jq .sha`.
 */
export const NODE20_CHECKOUT_SHAS: ReadonlyMap<string, string> = new Map([
  ["11d5960a326750d5838078e36cf38b85af677262", "v4.4.0"],
  ["34e114876b0b11c390a56381ad16ebd13914f8d5", "v4.3.1"],
  ["11bd71901bbe5b1630ceea73d27597364c9af683", "v4.2.2"],
]);

/** True when `uses` pins actions/checkout to a node20-runtime release. */
export function usesNode20Checkout(uses: string): boolean {
  const [action, ref] = uses.split("@");
  return action === "actions/checkout" && NODE20_CHECKOUT_SHAS.has(ref ?? "");
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

Deno.test("usesNode20Checkout flags each known node20 checkout SHA", () => {
  for (const sha of NODE20_CHECKOUT_SHAS.keys()) {
    assert(usesNode20Checkout(`actions/checkout@${sha}`));
  }
});

Deno.test("usesNode20Checkout accepts node24 checkout and unrelated actions", () => {
  assertEquals(
    usesNode20Checkout(
      "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
    ),
    false,
  );
  assertEquals(
    usesNode20Checkout(
      "actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd",
    ),
    false,
  );
  assertEquals(
    usesNode20Checkout(
      "other/action@11d5960a326750d5838078e36cf38b85af677262",
    ),
    false,
  );
  assertEquals(usesNode20Checkout("./.github/actions/local"), false);
});

Deno.test("no workflow pins actions/checkout to a node20 runtime release", async () => {
  const files = await workflowFiles();
  assert(files.length > 0, `no workflows found in ${WORKFLOW_DIR}`);

  let checked = 0;
  const offenders: string[] = [];
  for (const file of files) {
    for (const uses of usesRefs(parse(await Deno.readTextFile(file)))) {
      const [action, ref] = uses.split("@");
      if (action !== "actions/checkout") continue;
      checked++;
      const tag = NODE20_CHECKOUT_SHAS.get(ref ?? "");
      if (usesNode20Checkout(uses)) {
        offenders.push(`${file}: ${uses} (${tag})`);
      }
    }
  }

  assert(checked > 0, "no actions/checkout references found; scan is vacuous");
  assertEquals(
    offenders,
    [],
    "actions/checkout must be on a node24 release, e.g. v6.0.2",
  );
});

Deno.test("usesNode20GhRelease flags the node20 v2.6.2 pin", () => {
  assert(
    usesNode20GhRelease(
      "softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65",
    ),
  );
  assertEquals(
    NODE20_GH_RELEASE_SHAS.get("3bb12739c298aeb8a4eeaf626c5b8d85266b0e65"),
    "v2.6.2",
  );
});

Deno.test("usesNode20GhRelease accepts node24 and unrelated actions", () => {
  assertEquals(
    usesNode20GhRelease(
      "softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64",
    ),
    false,
  );
  assertEquals(
    usesNode20GhRelease(
      "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
    ),
    false,
  );
  assertEquals(
    usesNode20GhRelease(
      "other/action@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65",
    ),
    false,
  );
});

const FIXTURE_NODE20 = `
jobs:
  a:
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
      - uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65
`;
const FIXTURE_NODE24 = `
jobs:
  b:
    steps:
      - uses: softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64
`;

Deno.test("scanGhReleaseFiles reports node20 pins and counts only gh-release refs", () => {
  assertEquals(
    scanGhReleaseFiles(
      new Map([["n20.yml", FIXTURE_NODE20], ["n24.yml", FIXTURE_NODE24]]),
    ),
    {
      checked: 2,
      offenders: [
        "n20.yml: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 (v2.6.2)",
      ],
    },
  );
  assertEquals(scanGhReleaseFiles(new Map([["empty.yml", "jobs: {}"]])), {
    checked: 0,
    offenders: [],
  });
});

Deno.test("ghReleaseScanProblems fails a vacuous scan and lists node20 pins", () => {
  assertEquals(ghReleaseScanProblems(new Map([["empty.yml", "jobs: {}"]])), [
    "no softprops/action-gh-release references found; scan is vacuous",
  ]);
  assertEquals(
    ghReleaseScanProblems(new Map([["n24.yml", FIXTURE_NODE24]])),
    [],
  );
  assertEquals(
    ghReleaseScanProblems(new Map([["n20.yml", FIXTURE_NODE20]])),
    [
      "n20.yml: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 (v2.6.2)",
    ],
  );
});

Deno.test("usesRefs collects job-level and step-level uses and ignores non-strings", () => {
  assertEquals(
    usesRefs({
      jobs: {
        a: { uses: "./.github/workflows/x.yml" },
        b: { steps: [{ uses: "o/r@1" }, { run: "echo" }, { uses: 5 }] },
        c: { uses: 7 },
      },
    }),
    ["./.github/workflows/x.yml", "o/r@1"],
  );
  assertEquals(usesRefs(null), []);
  assertEquals(usesRefs({}), []);
  assertEquals(usesRefs({ jobs: { a: {} } }), []);
});

Deno.test("scanGhRelease counts job-level refs and tags offenders with the file", () => {
  const sha = "3bb12739c298aeb8a4eeaf626c5b8d85266b0e65";
  assertEquals(
    scanGhRelease("w.yml", {
      jobs: {
        a: { uses: `softprops/action-gh-release@${sha}` },
        b: { steps: [{ uses: "softprops/action-gh-release@v3" }] },
        c: { steps: [{ uses: `other/action@${sha}` }] },
      },
    }),
    {
      checked: 2,
      offenders: [`w.yml: softprops/action-gh-release@${sha} (v2.6.2)`],
    },
  );
  assertEquals(scanGhRelease("w.yml", null), { checked: 0, offenders: [] });
});

Deno.test("readWorkflowTexts maps each file path to its text", async () => {
  const files = await workflowFiles();
  const texts = await readWorkflowTexts(files);
  assertEquals([...texts.keys()], files);
  for (const [file, text] of texts) {
    assertEquals(text, await Deno.readTextFile(file));
  }
  assertEquals((await readWorkflowTexts([])).size, 0);
});

Deno.test("no workflow pins softprops/action-gh-release to node20", async () => {
  assertEquals(
    ghReleaseScanProblems(await readWorkflowTexts(await workflowFiles())),
    [],
    "softprops/action-gh-release must be on a node24 release, e.g. v3.0.3",
  );
});
