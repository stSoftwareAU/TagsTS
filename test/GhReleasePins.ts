// Guards against softprops/action-gh-release releases that run on the
// deprecated node20 Actions runtime, which GitHub removed on 2026-09-16
// (issue #106). The scanning logic lives in tools/GhReleasePins.ts.
import { assert, assertEquals } from "@std/assert";
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

export async function workflowFiles(dir = WORKFLOW_DIR): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isFile && /\.ya?ml$/.test(entry.name)) {
      files.push(`${dir}/${entry.name}`);
    }
  }
  return files.sort();
}

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

export const FIXTURE_NODE20 = `
jobs:
  a:
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
      - uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65
`;
export const FIXTURE_NODE24 = `
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
