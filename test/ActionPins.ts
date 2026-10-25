// Verifies every GitHub Action and reusable workflow referenced by the CI
// workflows is pinned to an immutable 40-character commit SHA rather than a
// mutable tag or branch (CWE-494). Tracked in issue #39. Also guards against
// releases of actions/checkout and streetsidesoftware/cspell-action that run on
// the deprecated node20 Actions runtime, which GitHub removed on 2026-09-16
// (issues #72 and #104). Node20 SHAs are verified with
// `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const WORKFLOW_DIR = ".github/workflows";
const SHA_PIN = /@[0-9a-f]{40}$/;

/** True when a `uses:` value is local, a docker image, or pinned to a SHA. */
export function isPinned(uses: string): boolean {
  if (uses.startsWith("./") || uses.startsWith("docker://")) return true;
  return SHA_PIN.test(uses);
}

/**
 * Commit SHAs, per action, whose `action.yml` declares `using: node20`, a
 * runtime GitHub removed on 2026-09-16 (issues #72 and #104). Each SHA maps to
 * the release tag it was taken from. Verified with
 * `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`.
 */
export const NODE20_ACTION_SHAS: ReadonlyMap<
  string,
  ReadonlyMap<string, string>
> = new Map<string, ReadonlyMap<string, string>>([
  [
    "actions/checkout",
    new Map<string, string>([
      ["11d5960a326750d5838078e36cf38b85af677262", "v4.4.0"],
      ["34e114876b0b11c390a56381ad16ebd13914f8d5", "v4.3.1"],
      ["11bd71901bbe5b1630ceea73d27597364c9af683", "v4.2.2"],
    ]),
  ],
  [
    "streetsidesoftware/cspell-action",
    new Map<string, string>([
      ["e464ae97d348eb3beb0c5a6296dc4388ad4484d9", "v6.11.1"],
    ]),
  ],
]);

/** actions/checkout node20 SHAs, derived from NODE20_ACTION_SHAS. */
export const NODE20_CHECKOUT_SHAS: ReadonlyMap<string, string> =
  NODE20_ACTION_SHAS.get("actions/checkout") ?? new Map<string, string>();

/**
 * True when `uses` pins a guarded action (see NODE20_ACTION_SHAS) to one of
 * that same action's node20-runtime SHAs. A SHA under another action's name
 * does not match.
 */
export function usesNode20Action(uses: string): boolean {
  const [action, ref] = uses.split("@");
  return NODE20_ACTION_SHAS.get(action)?.has(ref ?? "") ?? false;
}

/** True when `uses` pins actions/checkout to a node20-runtime release. */
export function usesNode20Checkout(uses: string): boolean {
  return uses.split("@")[0] === "actions/checkout" && usesNode20Action(uses);
}

/** Every `uses:` reference (step-level and job-level) in a parsed workflow. */
function usesRefs(doc: unknown): string[] {
  // deno-lint-ignore no-explicit-any
  const jobs = Object.values((doc as any)?.jobs ?? {}) as any[];
  return jobs.flatMap((job) => [
    ...(typeof job?.uses === "string" ? [job.uses] : []),
    ...((job?.steps ?? []) as Array<Record<string, unknown>>)
      .map((step) => step.uses)
      .filter((uses): uses is string => typeof uses === "string"),
  ]);
}

async function workflowFiles(): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(WORKFLOW_DIR)) {
    if (entry.isFile && /\.ya?ml$/.test(entry.name)) {
      files.push(`${WORKFLOW_DIR}/${entry.name}`);
    }
  }
  return files.sort();
}

Deno.test("isPinned accepts SHA pins, local and docker references", () => {
  assert(isPinned("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"));
  assert(isPinned("github/codeql-action/init@" + "a".repeat(40)));
  assert(isPinned("./.github/actions/local"));
  assert(isPinned("docker://alpine:3.20"));
});

Deno.test("isPinned rejects tags, branches and malformed SHAs", () => {
  assertEquals(isPinned("actions/checkout@v4"), false);
  assertEquals(isPinned("actions/checkout@main"), false);
  assertEquals(isPinned("actions/checkout"), false);
  assertEquals(isPinned("actions/checkout@" + "a".repeat(39)), false);
  assertEquals(isPinned("actions/checkout@" + "A".repeat(40)), false);
  assertEquals(isPinned("actions/checkout@" + "a".repeat(40) + "x"), false);
});

Deno.test("every workflow action is pinned to a commit SHA", async () => {
  const files = await workflowFiles();
  assert(files.length > 0, `no workflows found in ${WORKFLOW_DIR}`);

  let checked = 0;
  const unpinned: string[] = [];
  for (const file of files) {
    for (const uses of usesRefs(parse(await Deno.readTextFile(file)))) {
      checked++;
      if (!isPinned(uses)) unpinned.push(`${file}: ${uses}`);
    }
  }

  assert(checked > 0, "no `uses:` references found; the scan is vacuous");
  assertEquals(unpinned, [], "actions must be pinned to a 40-char commit SHA");
});

Deno.test("usesNode20Checkout flags each known node20 checkout SHA", () => {
  for (const sha of NODE20_CHECKOUT_SHAS.keys()) {
    assert(usesNode20Checkout(`actions/checkout@${sha}`));
  }
});

Deno.test("usesNode20Checkout accepts node24 checkout and unrelated actions", () => {
  assertEquals(
    usesNode20Checkout(
      "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
    ),
    false,
  );
  assertEquals(
    usesNode20Checkout(
      "actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd",
    ),
    false,
  );
  assertEquals(
    usesNode20Checkout(
      "other/action@11d5960a326750d5838078e36cf38b85af677262",
    ),
    false,
  );
  assertEquals(usesNode20Checkout("./.github/actions/local"), false);
  assertEquals(
    usesNode20Checkout(
      "streetsidesoftware/cspell-action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
    ),
    false,
  );
});

Deno.test("usesNode20Action flags each known node20 SHA of each guarded action", () => {
  for (const [action, shas] of NODE20_ACTION_SHAS) {
    for (const sha of shas.keys()) {
      assert(usesNode20Action(`${action}@${sha}`), `${action}@${sha}`);
    }
  }
});

// The literal is the issue #104 offending pin, kept independent of the map so deleting the map entry goes red.
Deno.test("usesNode20Action flags the cspell-action v6.11.1 pin from issue #104", () => {
  assert(
    usesNode20Action(
      "streetsidesoftware/cspell-action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
    ),
    "streetsidesoftware/cspell-action v6.11.1 (node20) pin must be flagged",
  );
});

Deno.test("usesNode20Action accepts node24 cspell-action and mismatched action/SHA pairs", () => {
  // cspell-action v9.1.0 (node24)
  assertEquals(
    usesNode20Action(
      "streetsidesoftware/cspell-action@6f3c77c1406bc930f944ba97e9801a22e42caf58",
    ),
    false,
  );
  // actions/checkout's node20 SHA under cspell-action's name
  assertEquals(
    usesNode20Action(
      "streetsidesoftware/cspell-action@11d5960a326750d5838078e36cf38b85af677262",
    ),
    false,
  );
  // cspell-action's node20 SHA under another action's name
  assertEquals(
    usesNode20Action(
      "other/action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
    ),
    false,
  );
  assertEquals(usesNode20Action("./.github/actions/local"), false);
});

Deno.test("no workflow pins a guarded action to a node20 runtime release", async () => {
  const files = await workflowFiles();
  assert(files.length > 0, `no workflows found in ${WORKFLOW_DIR}`);

  const checked = new Map<string, number>(
    [...NODE20_ACTION_SHAS.keys()].map((action): [string, number] => [
      action,
      0,
    ]),
  );
  const offenders: string[] = [];
  for (const file of files) {
    for (const uses of usesRefs(parse(await Deno.readTextFile(file)))) {
      const [action, ref] = uses.split("@");
      if (!NODE20_ACTION_SHAS.has(action)) continue;
      checked.set(action, (checked.get(action) ?? 0) + 1);
      if (usesNode20Action(uses)) {
        const tag = NODE20_ACTION_SHAS.get(action)?.get(ref ?? "");
        offenders.push(`${file}: ${uses} (${tag})`);
      }
    }
  }

  for (const [action, count] of checked) {
    assert(count > 0, `no ${action} references found; scan is vacuous`);
  }
  assertEquals(
    offenders,
    [],
    "each guarded action must be on a node24 release, e.g. actions/checkout v6.0.2 or streetsidesoftware/cspell-action v9.1.0",
  );
});
