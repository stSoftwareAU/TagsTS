// Keeps CONTRIBUTING.md and CHANGELOG.md honest against the workflows and
// package version they describe. Tracked in issue #56.
import { assert, assertStringIncludes } from "@std/assert";
import { parse } from "@std/yaml";

const VERSION_WORKFLOW = ".github/workflows/update-package-version.yml";

/** Branches the version-bump workflow runs its pull_request trigger on. */
async function versionBumpBranches(): Promise<string[]> {
  // deno-lint-ignore no-explicit-any
  const doc: any = parse(await Deno.readTextFile(VERSION_WORKFLOW));
  const branches = doc?.on?.pull_request?.branches;
  assert(
    Array.isArray(branches) && branches.length > 0,
    `${VERSION_WORKFLOW} must declare pull_request branches`,
  );
  return branches;
}

Deno.test("CONTRIBUTING.md names the integration branch PRs target", async () => {
  const contributing = await Deno.readTextFile("CONTRIBUTING.md");
  for (const branch of await versionBumpBranches()) {
    assertStringIncludes(contributing, `\`${branch}\``);
  }
});

Deno.test("CONTRIBUTING.md documents the quality gate and version bump", async () => {
  const contributing = await Deno.readTextFile("CONTRIBUTING.md");
  await Deno.stat("quality.sh");
  assertStringIncludes(contributing, "./quality.sh");
  assertStringIncludes(contributing, VERSION_WORKFLOW.replace(/^.*\//, ""));
});

Deno.test("CHANGELOG.md follows Keep a Changelog with resolvable headings", async () => {
  const changelog = await Deno.readTextFile("CHANGELOG.md");
  assertStringIncludes(changelog, "https://keepachangelog.com/");
  assert(
    /^## \[Unreleased\]$/m.test(changelog),
    "CHANGELOG.md needs an [Unreleased] section",
  );
  // Every "## [label]" heading needs a "[label]: url" reference, or it
  // renders as literal brackets instead of a link.
  const labels = [...changelog.matchAll(/^## \[([^\]]+)\]/gm)].map((m) => m[1]);
  for (const label of labels) {
    assert(
      new RegExp(`^\\[${RegExp.escape(label)}\\]: https://`, "m").test(
        changelog,
      ),
      `CHANGELOG.md heading [${label}] has no link reference`,
    );
  }
});
