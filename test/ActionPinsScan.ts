// Exercises scanDependencyReview from test/ActionPins.ts directly (issue
// #105). Importing that module also runs its own guard tests here, so a
// mutation of a changed line in it turns a test in this file red.
import { assertEquals } from "@std/assert";
import { parse } from "@std/yaml";
import { scanDependencyReview } from "./ActionPins.ts";

const NODE20 = "actions/dependency-review-action@" +
  "2031cfc080254a8a887f58cffee85186f0e49e48";
const NODE24 = "actions/dependency-review-action@" +
  "a1d282b36b6f3519aa1f3fc636f609c47dddb294";

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
