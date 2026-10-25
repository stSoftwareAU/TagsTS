// Keep both guard modules discoverable by Deno's default test file pattern.
import "./ActionPins.ts";
import "./ActionPinsScan.ts";
import { assert, assertEquals, assertStringIncludes } from "@std/assert";

/** Run a guard against a faulty fixture without editing the working tree. */
async function runGuardFixture(
  module: "ActionPins.ts" | "ActionPinsScan.ts",
  testName: string,
  replacement?: readonly [string, string],
): Promise<string> {
  const directory = await Deno.makeTempDir({ prefix: "action-pins-" });
  try {
    let source = await Deno.readTextFile(
      new URL("./ActionPins.ts", import.meta.url),
    );
    if (replacement) {
      const [before, after] = replacement;
      assertEquals(
        source.split(before).length,
        2,
        "fault must be injected once",
      );
      source = source.replace(before, after);
    }
    await Deno.writeTextFile(`${directory}/ActionPins.ts`, source);
    await Deno.copyFile(
      new URL("./ActionPinsScan.ts", import.meta.url),
      `${directory}/ActionPinsScan.ts`,
    );
    await Deno.mkdir(`${directory}/.github/workflows`, { recursive: true });
    const result = await new Deno.Command(Deno.execPath(), {
      cwd: directory,
      args: [
        "test",
        "--allow-read",
        "--no-check",
        "--config",
        new URL("../deno.json", import.meta.url).pathname,
        "--filter",
        testName,
        module,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const output = new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr);
    assert(!result.success, `guard accepted the faulty fixture:\n${output}`);
    assertStringIncludes(output, "AssertionError");
    assertStringIncludes(output, "1 failed");
    return output;
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

Deno.test("dependency-review negative test rejects a misclassified local action", async () => {
  await runGuardFixture(
    "ActionPins.ts",
    "usesNode20DependencyReview accepts node24 v5.0.0 and unrelated actions",
    [
      "export function usesNode20DependencyReview(uses: string): boolean {",
      "export function usesNode20DependencyReview(uses: string): boolean {\n" +
      '  if (uses.startsWith("./")) return true;',
    ],
  );
});

Deno.test("dependency-review empty-list test rejects an incorrect scan count", async () => {
  await runGuardFixture(
    "ActionPinsScan.ts",
    "scanDependencyReview returns an object for an empty list",
    [
      "return { checked, offenders };",
      "return { checked: docs.length === 0 ? 1 : checked, offenders };",
    ],
  );
});

Deno.test("dependency-review workflow guard rejects an empty workflow directory", async () => {
  const output = await runGuardFixture(
    "ActionPins.ts",
    "no workflow pins actions/dependency-review-action to a node20 runtime release",
  );
  assertStringIncludes(output, "no workflows found in .github/workflows");
});
