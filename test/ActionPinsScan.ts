// Exercises scanDependencyReview (issue #105) and scanCspell (issue #104) from
// test/ActionPins.ts directly. Importing that module also runs its own guard
// tests here, so a mutation of a changed line in it turns a test in this file
// red.
import { assertEquals, assertRejects } from "@std/assert";
import { parse } from "@std/yaml";
import {
  loadWorkflowDocs,
  scanCspell,
  scanDependencyReview,
} from "./ActionPins.ts";

const NODE20 = "actions/dependency-review-action@" +
  "2031cfc080254a8a887f58cffee85186f0e49e48";
const NODE24 = "actions/dependency-review-action@" +
  "a1d282b36b6f3519aa1f3fc636f609c47dddb294";
const CSPELL_NODE20 = "streetsidesoftware/cspell-action@" +
  "e464ae97d348eb3beb0c5a6296dc4388ad4484d9";
const CSPELL_NODE24 = "streetsidesoftware/cspell-action@" +
  "ce1816e4ce36532956ac6e983737392774b6e169";

Deno.test("scanDependencyReview returns an object for an empty list", () => {
  assertEquals(scanDependencyReview([]), { checked: 0, offenders: [] });
});

Deno.test("scanDependencyReview aggregates counts and offenders across files", () => {
  const a = parse(`jobs:\n  j:\n    steps:\n      - uses: ${NODE20}\n`);
  const b = parse(`jobs:\n  j:\n    steps:\n      - uses: ${NODE24}\n`);
  assertEquals(scanDependencyReview([["a.yml", a], ["b.yml", b]]), {
    checked: 2,
    offenders: [`a.yml: ${NODE20} (v4.9.0)`],
  });
});

Deno.test("scanDependencyReview finds a job-level reference and ignores others", () => {
  const doc = parse(
    `jobs:\n  j:\n    uses: ${NODE20}\n  k:\n    uses: ./x.yml\n`,
  );
  assertEquals(scanDependencyReview([["w.yml", doc]]), {
    checked: 1,
    offenders: [`w.yml: ${NODE20} (v4.9.0)`],
  });
});

Deno.test("scanCspell returns an object for an empty list", () => {
  assertEquals(scanCspell([]), { checked: 0, offenders: [] });
});

Deno.test("scanCspell aggregates counts and offenders across files", () => {
  const a = parse(`jobs:\n  j:\n    steps:\n      - uses: ${CSPELL_NODE20}\n`);
  const b = parse(`jobs:\n  j:\n    steps:\n      - uses: ${CSPELL_NODE24}\n`);
  assertEquals(scanCspell([["a.yml", a], ["b.yml", b]]), {
    checked: 2,
    offenders: [`a.yml: ${CSPELL_NODE20} (v6.11.1)`],
  });
});

Deno.test("scanCspell finds a job-level reference and ignores others", () => {
  const doc = parse(
    `jobs:\n  j:\n    uses: ${CSPELL_NODE20}\n  k:\n    uses: ./x.yml\n`,
  );
  assertEquals(scanCspell([["w.yml", doc]]), {
    checked: 1,
    offenders: [`w.yml: ${CSPELL_NODE20} (v6.11.1)`],
  });
});

Deno.test("scanCspell ignores a node20 SHA under a different action", () => {
  const doc = parse(
    "jobs:\n  j:\n    steps:\n      - uses: actions/checkout@e464ae97d348eb3beb0c5a6296dc4388ad4484d9\n",
  );
  assertEquals(scanCspell([["w.yml", doc]]), {
    checked: 0,
    offenders: [],
  });
});

Deno.test("scanCspell labels a v7.2.1 pin", () => {
  const doc = parse(
    "jobs:\n  j:\n    steps:\n      - uses: streetsidesoftware/cspell-action@76c6f6d52abd57f4bcab5f3fde1bbd4f19a99eb0\n",
  );
  assertEquals(scanCspell([["w.yml", doc]]).offenders, [
    "w.yml: streetsidesoftware/cspell-action@76c6f6d52abd57f4bcab5f3fde1bbd4f19a99eb0 (v7.2.1)",
  ]);
});

Deno.test("loadWorkflowDocs rejects an empty workflow directory", async () => {
  const dir = await Deno.makeTempDir({ prefix: "action-pins-" });
  try {
    await assertRejects(
      () => loadWorkflowDocs(dir),
      Error,
      `no workflows found in ${dir}`,
    );
    await Deno.writeTextFile(`${dir}/w.yml`, "jobs: {}\n");
    assertEquals((await loadWorkflowDocs(dir)).length, 1);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
