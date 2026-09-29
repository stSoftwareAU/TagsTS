// Keeps the every-change test gate quiet: a green run prints dots and one
// summary line, so a real failure is not buried in per-test pass lines.
// Tracked in issue #55.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

/** Every `deno test` command line in a shell script, continuations joined. */
export function denoTestCommands(script: string): string[] {
  return script.replace(/\\\n/g, " ").split("\n")
    .filter((line) => /^\s*deno\s+test\b/.test(line))
    .map((line) => line.trim());
}

/** Commands that would print a line per test (no quiet reporter chosen). */
export function verboseCommands(script: string): string[] {
  return denoTestCommands(script).filter((line) =>
    !/(?:^|\s)--reporter[=\s]+["']?dot\b/.test(line)
  );
}

/** Every `run:` script in a workflow document. */
function workflowScripts(doc: unknown): string {
  // deno-lint-ignore no-explicit-any
  const jobs = Object.values((doc as any)?.jobs ?? {});
  return jobs
    // deno-lint-ignore no-explicit-any
    .flatMap((job: any) => job?.steps ?? [])
    // deno-lint-ignore no-explicit-any
    .map((step: any) => step?.run)
    .filter((run: unknown): run is string => typeof run === "string")
    .join("\n");
}

Deno.test("verboseCommands - flags a deno test without a reporter", () => {
  assertEquals(verboseCommands("set -e\ndeno test --allow-all test/*\n"), [
    "deno test --allow-all test/*",
  ]);
});

Deno.test("verboseCommands - accepts both spellings of the dot reporter", () => {
  const script = "deno test --reporter=dot test/*\n" +
    "  deno test --reporter dot -A \\\n    test/*.ts\n";
  assertEquals(denoTestCommands(script).length, 2);
  assertEquals(verboseCommands(script), []);
});

Deno.test("verboseCommands - rejects a non-dot reporter", () => {
  assertEquals(verboseCommands("deno test --reporter=pretty test/*").length, 1);
});

Deno.test("verboseCommands - ignores lines that merely mention deno test", () => {
  assertEquals(denoTestCommands("# run deno test later\necho deno test"), []);
});

Deno.test("quality.sh runs deno test with the dot reporter", async () => {
  const script = await Deno.readTextFile("quality.sh");
  assert(denoTestCommands(script).length > 0, "quality.sh must run tests");
  assertEquals(verboseCommands(script), []);
});

Deno.test("quality workflow runs deno test with the dot reporter", async () => {
  const doc = parse(
    await Deno.readTextFile(".github/workflows/quality.yml"),
  );
  const scripts = workflowScripts(doc);
  assert(denoTestCommands(scripts).length > 0, "workflow must run tests");
  assertEquals(verboseCommands(scripts), []);
});
