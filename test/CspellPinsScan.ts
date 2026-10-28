// Exercises the streetsidesoftware/cspell-action guard in test/ActionPins.ts
// directly (issue #104), the way test/ActionPinsScan.ts exercises the
// dependency-review guard. Importing that module also runs its own guard
// tests here, so a mutation of a changed line in it turns a test in this file
// red.
import { assertEquals } from "@std/assert";
import { parse } from "@std/yaml";
import {
  NODE20_CSPELL_SHAS,
  scanCspell,
  usesNode20Cspell,
} from "./ActionPins.ts";

const NODE20 = "streetsidesoftware/cspell-action@" +
  "e464ae97d348eb3beb0c5a6296dc4388ad4484d9";
const NODE24 = "streetsidesoftware/cspell-action@" +
  "ce1816e4ce36532956ac6e983737392774b6e169";

Deno.test("NODE20_CSPELL_SHAS denylists exactly the v6.11.1 SHA", () => {
  assertEquals([...NODE20_CSPELL_SHAS], [[
    "e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
    "v6.11.1",
  ]]);
});

Deno.test("usesNode20Cspell is true only for the action on a denylisted SHA", () => {
  assertEquals(usesNode20Cspell(NODE20), true);
  assertEquals(usesNode20Cspell(NODE24), false);
  assertEquals(usesNode20Cspell("streetsidesoftware/cspell-action"), false);
  assertEquals(
    usesNode20Cspell(
      "other/action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
    ),
    false,
  );
});

Deno.test("scanCspell returns an empty result for no documents", () => {
  assertEquals(scanCspell([]), { checked: 0, offenders: [] });
});

Deno.test("scanCspell aggregates counts and offenders across files", () => {
  const a = parse(`jobs:\n  j:\n    steps:\n      - uses: ${NODE20}\n`);
  const b = parse(`jobs:\n  j:\n    steps:\n      - uses: ${NODE24}\n`);
  assertEquals(scanCspell([["a.yml", a], ["b.yml", b]]), {
    checked: 2,
    offenders: [`a.yml: ${NODE20} (v6.11.1)`],
  });
});

Deno.test("scanCspell ignores other actions even on a denylisted SHA", () => {
  const doc = parse(
    `jobs:\n  j:\n    steps:\n      - uses: actions/checkout@v6\n` +
      `      - uses: other/action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9\n` +
      `      - uses: ./local\n`,
  );
  assertEquals(scanCspell([["w.yml", doc]]), { checked: 0, offenders: [] });
});

Deno.test("scanCspell finds a job-level reference", () => {
  const doc = parse(`jobs:\n  j:\n    uses: ${NODE20}\n`);
  assertEquals(scanCspell([["w.yml", doc]]), {
    checked: 1,
    offenders: [`w.yml: ${NODE20} (v6.11.1)`],
  });
});
