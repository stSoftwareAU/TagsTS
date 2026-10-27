// Exercises the softprops/action-gh-release guard directly (issue #106), the
// way test/ActionPinsScan.ts exercises test/ActionPins.ts. Importing
// test/GhReleasePins.ts also runs its own guard tests here, so a mutation of a
// changed line in it, or in tools/GhReleasePins.ts, turns a test in this file
// red.
import { assert, assertEquals } from "@std/assert";
import * as pins from "./GhReleasePins.ts";
import * as tools from "../tools/GhReleasePins.ts";

const NODE20 = "softprops/action-gh-release@" +
  "3bb12739c298aeb8a4eeaf626c5b8d85266b0e65";
const NODE24 = "softprops/action-gh-release@" +
  "efb35369e0ad2afab669f228072c1b0d510eae64";

Deno.test("github-release.yml keeps a SHA pin with a version comment", async () => {
  const text = await Deno.readTextFile(".github/workflows/github-release.yml");
  assert(
    /uses: softprops\/action-gh-release@[0-9a-f]{40} # v\d+\.\d+\.\d+/.test(
      text,
    ),
    "github-release.yml must pin softprops/action-gh-release to a 40-character SHA followed by a `# v<semver>` comment",
  );
});

Deno.test("usesNode20GhRelease is true only for the action on a denylisted SHA", () => {
  assertEquals(tools.usesNode20GhRelease(NODE20), true);
  assertEquals(tools.usesNode20GhRelease(NODE24), false);
  assertEquals(tools.usesNode20GhRelease("softprops/action-gh-release"), false);
  assertEquals(
    tools.usesNode20GhRelease(
      "other/action@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65",
    ),
    false,
  );
  for (const sha of tools.NODE20_GH_RELEASE_SHAS.keys()) {
    assertEquals(
      tools.usesNode20GhRelease(`softprops/action-gh-release@${sha}`),
      true,
    );
  }
});

Deno.test("usesRefs lists job-level then step-level uses", () => {
  assertEquals(
    tools.usesRefs({
      jobs: { a: { uses: "x/y@1", steps: [{ uses: "p/q@2" }, { run: "z" }] } },
    }),
    ["x/y@1", "p/q@2"],
  );
  assertEquals(tools.usesRefs(undefined), []);
});

Deno.test("scanGhRelease counts every gh-release ref and flags node20 ones", () => {
  const doc = {
    jobs: {
      a: { steps: [{ uses: NODE20 }, { uses: NODE24 }, { uses: "o/r@1" }] },
    },
  };
  assertEquals(tools.scanGhRelease("w.yml", doc), {
    checked: 2,
    offenders: [`w.yml: ${NODE20} (v2.6.2)`],
  });
  assertEquals(tools.scanGhRelease("w.yml", { jobs: { a: { steps: [] } } }), {
    checked: 0,
    offenders: [],
  });
});

Deno.test("scanGhReleaseFiles sums counts and offenders across files", () => {
  assertEquals(
    tools.scanGhReleaseFiles(
      new Map([["a.yml", pins.FIXTURE_NODE20], ["b.yml", pins.FIXTURE_NODE24]]),
    ),
    { checked: 2, offenders: [`a.yml: ${NODE20} (v2.6.2)`] },
  );
  assertEquals(tools.scanGhReleaseFiles(new Map()), {
    checked: 0,
    offenders: [],
  });
});

Deno.test("ghReleaseScanProblems puts the vacuity problem before offenders", () => {
  assertEquals(tools.ghReleaseScanProblems(new Map()), [
    "no softprops/action-gh-release references found; scan is vacuous",
  ]);
  assertEquals(
    tools.ghReleaseScanProblems(new Map([["b.yml", pins.FIXTURE_NODE24]])),
    [],
  );
  assertEquals(
    tools.ghReleaseScanProblems(new Map([["a.yml", pins.FIXTURE_NODE20]])),
    [`a.yml: ${NODE20} (v2.6.2)`],
  );
});

Deno.test("workflowFiles lists sorted workflow paths and readWorkflowTexts reads them", async () => {
  const files = await pins.workflowFiles();
  assert(files.length > 0);
  assertEquals(files, [...files].sort());
  assert(files.every((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f)));
  assert(files.includes(".github/workflows/github-release.yml"));
  const texts = await tools.readWorkflowTexts(files);
  assertEquals([...texts.keys()], files);
  assertEquals(
    texts.get(".github/workflows/github-release.yml"),
    await Deno.readTextFile(".github/workflows/github-release.yml"),
  );
});

Deno.test("workflowFiles keeps only yaml files, not directories or other files", async () => {
  const dir = await Deno.makeTempDir({ prefix: "gh-release-pins-" });
  try {
    await Deno.writeTextFile(`${dir}/b.yml`, "");
    await Deno.writeTextFile(`${dir}/a.yaml`, "");
    await Deno.writeTextFile(`${dir}/c.txt`, "");
    await Deno.mkdir(`${dir}/d.yml`);
    assertEquals(await pins.workflowFiles(dir), [
      `${dir}/a.yaml`,
      `${dir}/b.yml`,
    ]);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
