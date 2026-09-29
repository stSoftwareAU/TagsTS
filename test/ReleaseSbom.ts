// Verifies the release SBOM contract: `deno info --json` graphs convert to a
// deterministic CycloneDX document, and the release workflow attaches it as a
// release asset (issue #57).
import { assert, assertEquals, assertThrows } from "@std/assert";
import { parse } from "@std/yaml";
import { exportRoots, toCycloneDx } from "../tools/Sbom.ts";

const WORKFLOW_PATH = ".github/workflows/github-release.yml";
const SBOM_FILE = "sbom.cdx.json";

const MOD_INFO = {
  packages: {
    "@std/cli@1.0.32": "@std/cli@1.0.32",
    "@std/internal@^1.0.14": "@std/internal@1.0.14",
  },
  npmPackages: {},
};
const APP_INFO = {
  packages: { "@std/cli@1.0.32": "@std/cli@1.0.32" },
  npmPackages: {
    "chalk@5.3.0": { name: "chalk", version: "5.3.0", dependencies: [] },
  },
};

Deno.test("toCycloneDx lists each resolved package once, sorted, with purls", () => {
  const bom = toCycloneDx("@stsoftware/tags", "1.2.3", [APP_INFO, MOD_INFO]);
  assertEquals(bom.bomFormat, "CycloneDX");
  assertEquals(bom.specVersion, "1.5");
  assertEquals(bom.metadata.component.purl, "pkg:jsr/%40stsoftware/tags@1.2.3");
  assertEquals(
    bom.components.map((c) => c.purl),
    [
      "pkg:jsr/%40std/cli@1.0.32",
      "pkg:jsr/%40std/internal@1.0.14",
      "pkg:npm/chalk@5.3.0",
    ],
  );
  assertEquals(bom.components[0], {
    type: "library",
    "bom-ref": "pkg:jsr/%40std/cli@1.0.32",
    name: "@std/cli",
    version: "1.0.32",
    purl: "pkg:jsr/%40std/cli@1.0.32",
  });
});

Deno.test("toCycloneDx is deterministic so release SBOMs diff cleanly", () => {
  const a = toCycloneDx("@stsoftware/tags", "1.2.3", [MOD_INFO, APP_INFO]);
  const b = toCycloneDx("@stsoftware/tags", "1.2.3", [APP_INFO, MOD_INFO]);
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test("toCycloneDx accepts graphs with no packages", () => {
  const bom = toCycloneDx("@stsoftware/tags", "1.2.3", [
    { packages: null, npmPackages: null },
    {},
  ]);
  assertEquals(bom.components, []);
});

Deno.test("toCycloneDx rejects malformed deno info output", () => {
  assertThrows(() => toCycloneDx("@s/t", "1.0.0", [null]), Error, "object");
  assertThrows(
    () => toCycloneDx("@s/t", "1.0.0", [{ packages: { a: "no-version" } }]),
    Error,
    "no-version",
  );
  assertThrows(
    () => toCycloneDx("@s/t", "1.0.0", [{ npmPackages: { x: { name: "x" } } }]),
    Error,
    "npm package",
  );
  assertThrows(() => toCycloneDx("", "1.0.0", []), Error, "name");
});

Deno.test("exportRoots returns every export target of deno.json", () => {
  assertEquals(
    exportRoots({ exports: { "./mod": "./mod.ts", "./App": "./App.ts" } }),
    ["./App.ts", "./mod.ts"],
  );
  assertEquals(exportRoots({ exports: "./mod.ts" }), ["./mod.ts"]);
  assertThrows(() => exportRoots({}), Error, "exports");
  assertThrows(() => exportRoots({ exports: { "./x": 1 } }), Error, "exports");
});

Deno.test("release workflow generates the SBOM and attaches it to the release", async () => {
  // deno-lint-ignore no-explicit-any
  const doc = parse(await Deno.readTextFile(WORKFLOW_PATH)) as any;
  // deno-lint-ignore no-explicit-any
  const steps: any[] = doc?.jobs?.release?.steps ?? [];

  const setup = steps.find((s) =>
    typeof s.uses === "string" && s.uses.startsWith("denoland/setup-deno@")
  );
  assert(setup, "release job must set up Deno to build the SBOM");
  assert(
    /^v?\d+\.\d+\.\d+$/.test(String(setup.with?.["deno-version"] ?? "")),
    "release job must pin an exact Deno version",
  );

  const generate = steps.findIndex((s) =>
    typeof s.run === "string" && s.run.includes("tools/Sbom.ts") &&
    s.run.includes(SBOM_FILE)
  );
  assert(generate >= 0, `release job must write ${SBOM_FILE}`);

  const release = steps.findIndex((s) =>
    typeof s.uses === "string" &&
    s.uses.startsWith("softprops/action-gh-release@")
  );
  assert(release > generate, "SBOM must be generated before the release");
  assertEquals(String(steps[release].with?.files ?? "").trim(), SBOM_FILE);
  assertEquals(
    steps[release].with?.fail_on_unmatched_files,
    true,
    "a missing SBOM must fail the release, not be skipped",
  );
});
