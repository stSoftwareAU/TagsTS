// Verifies a CODEOWNERS file puts a named owner on every privileged CI path, so
// a pull request editing a workflow that holds ACTIONS_PUSH, the JSR OIDC
// id-token or a scanner secret cannot merge without an owner's review.
// Tracked in issue #53.
import { assert, assertEquals } from "@std/assert";

// GitHub recognises CODEOWNERS at exactly these three locations, in this order.
const LOCATIONS = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"];
const WORKFLOW_DIR = ".github/workflows";

// A @user or @org/team handle.
const OWNER =
  /^@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9._-]+)?$/;

interface Rule {
  pattern: string;
  owners: string[];
}

/** Parse CODEOWNERS text into rules, skipping comments and blank lines. */
export function parseCodeowners(text: string): Rule[] {
  return text.split("\n")
    .map((raw) => raw.replace(/#.*$/, "").trim())
    .filter((line) => line !== "")
    .map((line) => {
      const [pattern, ...owners] = line.split(/\s+/);
      return { pattern, owners };
    });
}

/**
 * True when `pattern` matches the repo-relative `path`. Covers the forms this
 * repository uses: `*`, anchored or unanchored directories (`/dir/`) and exact
 * files. Wildcards inside a path are deliberately unsupported.
 */
export function matches(pattern: string, path: string): boolean {
  if (pattern === "*") return true;
  const target = pattern.replace(/^\//, "");
  if (target.includes("*")) {
    throw new Error(`unsupported CODEOWNERS pattern: ${pattern}`);
  }
  if (target.endsWith("/")) return path.startsWith(target);
  return path === target || path.startsWith(`${target}/`);
}

/** Owners of `path`: GitHub applies the last matching rule. */
export function ownersOf(rules: Rule[], path: string): string[] {
  const hit = rules.findLast((rule) => matches(rule.pattern, path));
  return hit?.owners ?? [];
}

async function loadRules(): Promise<Rule[]> {
  for (const path of LOCATIONS) {
    try {
      return parseCodeowners(await Deno.readTextFile(path));
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  throw new Error(`no CODEOWNERS file at any of: ${LOCATIONS.join(", ")}`);
}

function assertOwned(rules: Rule[], path: string): void {
  const owners = ownersOf(rules, path);
  assert(owners.length > 0, `${path} has no code owner`);
  for (const owner of owners) {
    assert(OWNER.test(owner), `${path}: '${owner}' is not a valid owner`);
  }
}

Deno.test("every workflow file has a valid code owner", async () => {
  const rules = await loadRules();
  let count = 0;
  for await (const entry of Deno.readDir(WORKFLOW_DIR)) {
    if (!entry.isFile) continue;
    assertOwned(rules, `${WORKFLOW_DIR}/${entry.name}`);
    count++;
  }
  assert(count > 0, `no workflow files found under ${WORKFLOW_DIR}`);
});

Deno.test("composite actions and CODEOWNERS itself have a code owner", async () => {
  const rules = await loadRules();
  // A future composite action lands here; CODEOWNERS guards its own rules.
  assertOwned(rules, ".github/actions/setup/action.yml");
  assertOwned(rules, ".github/CODEOWNERS");
});

Deno.test("ownersOf applies the last matching rule", () => {
  const rules = parseCodeowners(
    "# comment\n* @a\n/.github/workflows/ @b @org/team\n/.github/workflows/x.yml\n",
  );
  assertEquals(ownersOf(rules, ".github/workflows/y.yml"), ["@b", "@org/team"]);
  // A later owner-less rule strips ownership — the case the gate must catch.
  assertEquals(ownersOf(rules, ".github/workflows/x.yml"), []);
  assertEquals(ownersOf(rules, "src/mod.ts"), ["@a"]);
  assertEquals(ownersOf(parseCodeowners(""), "src/mod.ts"), []);
});
