// Verifies every GitHub Action and reusable workflow referenced by the CI
// workflows is pinned to an immutable 40-character commit SHA rather than a
// mutable tag or branch (CWE-494). Tracked in issue #39. Also guards against
// actions/checkout releases that run on the deprecated node20 Actions
// runtime, which GitHub removed on 2026-09-16 (issue #72), and
// actions/dependency-review-action v4.x releases on node20 (issue #105), and
// streetsidesoftware/cspell-action v6.x releases on node20 (issue #104).
// The softprops/action-gh-release node20 guard (issue #106) is in
// test/GhReleasePins.ts.
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";
import { usesRefs } from "../tools/GhReleasePins.ts";

const WORKFLOW_DIR = ".github/workflows";
const SHA_PIN = /@[0-9a-f]{40}$/;

/** True when a `uses:` value is local, a docker image, or pinned to a SHA. */
export function isPinned(uses: string): boolean {
  if (uses.startsWith("./") || uses.startsWith("docker://")) return true;
  return SHA_PIN.test(uses);
}

/**
 * actions/checkout commit SHAs whose `action.yml` declares `using: node20`,
 * a runtime GitHub removed on 2026-09-16 (issue #72). Verified with
 * `gh api repos/actions/checkout/commits/<tag> --jq .sha`.
 */
export const NODE20_CHECKOUT_SHAS: ReadonlyMap<string, string> = new Map([
  ["11d5960a326750d5838078e36cf38b85af677262", "v4.4.0"],
  ["34e114876b0b11c390a56381ad16ebd13914f8d5", "v4.3.1"],
  ["11bd71901bbe5b1630ceea73d27597364c9af683", "v4.2.2"],
]);

/** True when `uses` pins actions/checkout to a node20-runtime release. */
export function usesNode20Checkout(uses: string): boolean {
  const [action, ref] = uses.split("@");
  return action === "actions/checkout" && NODE20_CHECKOUT_SHAS.has(ref ?? "");
}

/**
 * actions/dependency-review-action commit SHAs whose `action.yml` declares
 * `using: node20` (issue #105). Verified with
 * `gh api repos/actions/dependency-review-action/commits/<tag> --jq .sha`.
 */
export const NODE20_DEPENDENCY_REVIEW_SHAS: ReadonlyMap<string, string> =
  new Map([
    ["2031cfc080254a8a887f58cffee85186f0e49e48", "v4.9.0"],
  ]);

/** True when `uses` pins actions/dependency-review-action to a node20 release. */
export function usesNode20DependencyReview(uses: string): boolean {
  const [action, ref] = uses.split("@");
  return action === "actions/dependency-review-action" &&
    NODE20_DEPENDENCY_REVIEW_SHAS.has(ref ?? "");
}

async function workflowFiles(dir = WORKFLOW_DIR): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isFile && /\.ya?ml$/.test(entry.name)) {
      files.push(`${dir}/${entry.name}`);
    }
  }
  return files.sort();
}

/** Parse every workflow in `dir`; an empty directory fails loudly. */
export async function loadWorkflowDocs(
  dir = WORKFLOW_DIR,
): Promise<Array<readonly [string, unknown]>> {
  const files = await workflowFiles(dir);
  assert(files.length > 0, `no workflows found in ${dir}`);
  const docs: Array<readonly [string, unknown]> = [];
  for (const file of files) {
    docs.push([file, parse(await Deno.readTextFile(file))]);
  }
  return docs;
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
});

Deno.test("no workflow pins actions/checkout to a node20 runtime release", async () => {
  const files = await workflowFiles();
  assert(files.length > 0, `no workflows found in ${WORKFLOW_DIR}`);

  let checked = 0;
  const offenders: string[] = [];
  for (const file of files) {
    for (const uses of usesRefs(parse(await Deno.readTextFile(file)))) {
      const [action, ref] = uses.split("@");
      if (action !== "actions/checkout") continue;
      checked++;
      const tag = NODE20_CHECKOUT_SHAS.get(ref ?? "");
      if (usesNode20Checkout(uses)) {
        offenders.push(`${file}: ${uses} (${tag})`);
      }
    }
  }

  assert(checked > 0, "no actions/checkout references found; scan is vacuous");
  assertEquals(
    offenders,
    [],
    "actions/checkout must be on a node24 release, e.g. v6.0.2",
  );
});

Deno.test("usesNode20DependencyReview flags the known node20 SHA", () => {
  assert(
    usesNode20DependencyReview(
      "actions/dependency-review-action@2031cfc080254a8a887f58cffee85186f0e49e48",
    ),
  );
});

Deno.test("usesNode20DependencyReview accepts node24 v5.0.0 and unrelated actions", () => {
  assertEquals(
    usesNode20DependencyReview(
      "actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294",
    ),
    false,
  );
  assertEquals(
    usesNode20DependencyReview(
      "other/action@2031cfc080254a8a887f58cffee85186f0e49e48",
    ),
    false,
  );
  assertEquals(
    usesNode20DependencyReview(
      "actions/checkout@2031cfc080254a8a887f58cffee85186f0e49e48",
    ),
    false,
  );
  assertEquals(usesNode20DependencyReview("./.github/actions/local"), false);
});

/** Counts dependency-review-action references and lists node20 offenders. */
export function scanDependencyReview(
  docs: ReadonlyArray<readonly [string, unknown]>,
): { checked: number; offenders: string[] } {
  let checked = 0;
  const offenders: string[] = [];
  for (const [file, doc] of docs) {
    for (const uses of usesRefs(doc)) {
      const [action, ref] = uses.split("@");
      if (action !== "actions/dependency-review-action") continue;
      checked++;
      const tag = NODE20_DEPENDENCY_REVIEW_SHAS.get(ref ?? "");
      if (usesNode20DependencyReview(uses)) {
        offenders.push(`${file}: ${uses} (${tag})`);
      }
    }
  }
  return { checked, offenders };
}

Deno.test("scanDependencyReview lists a node20 pin and counts every reference", () => {
  const node20 = "actions/dependency-review-action@" +
    "2031cfc080254a8a887f58cffee85186f0e49e48";
  const node24 = "actions/dependency-review-action@" +
    "a1d282b36b6f3519aa1f3fc636f609c47dddb294";
  const doc = parse(
    `jobs:\n  a:\n    steps:\n      - uses: ${node20}\n      - uses: ${node24}\n      - uses: actions/checkout@v6\n`,
  );
  assertEquals(scanDependencyReview([["wf.yml", doc]]), {
    checked: 2,
    offenders: [`wf.yml: ${node20} (v4.9.0)`],
  });
  assertEquals(scanDependencyReview([["empty.yml", {}]]), {
    checked: 0,
    offenders: [],
  });
});

Deno.test("no workflow pins actions/dependency-review-action to a node20 runtime release", async () => {
  const { checked, offenders } = scanDependencyReview(
    await loadWorkflowDocs(),
  );

  assert(
    checked > 0,
    "no actions/dependency-review-action references found; scan is vacuous",
  );
  assertEquals(
    offenders,
    [],
    "actions/dependency-review-action must be on a node24 release, e.g. v5.0.0",
  );
});

/**
 * streetsidesoftware/cspell-action commit SHAs whose `action.yml` declares
 * `using: node20` (issue #104). Verified with
 * `gh api repos/streetsidesoftware/cspell-action/commits/<tag> --jq .sha`.
 */
export const NODE20_CSPELL_SHAS: ReadonlyMap<string, string> = new Map([
  ["e464ae97d348eb3beb0c5a6296dc4388ad4484d9", "v6.11.1"],
]);

/** True when `uses` pins streetsidesoftware/cspell-action to a node20 release. */
export function usesNode20Cspell(uses: string): boolean {
  const [action, ref] = uses.split("@");
  return action === "streetsidesoftware/cspell-action" &&
    NODE20_CSPELL_SHAS.has(ref ?? "");
}

/** Counts cspell-action references and lists node20 offenders. */
export function scanCspell(
  docs: ReadonlyArray<readonly [string, unknown]>,
): { checked: number; offenders: string[] } {
  let checked = 0;
  const offenders: string[] = [];
  for (const [file, doc] of docs) {
    for (const uses of usesRefs(doc)) {
      const [action, ref] = uses.split("@");
      if (action !== "streetsidesoftware/cspell-action") continue;
      checked++;
      const tag = NODE20_CSPELL_SHAS.get(ref ?? "");
      if (usesNode20Cspell(uses)) {
        offenders.push(`${file}: ${uses} (${tag})`);
      }
    }
  }
  return { checked, offenders };
}

Deno.test("usesNode20Cspell flags the known node20 SHA", () => {
  assert(
    usesNode20Cspell(
      "streetsidesoftware/cspell-action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
    ),
  );
});

Deno.test("usesNode20Cspell accepts node24 v9.2.0 and unrelated actions", () => {
  assertEquals(
    usesNode20Cspell(
      "streetsidesoftware/cspell-action@ce1816e4ce36532956ac6e983737392774b6e169",
    ),
    false,
  );
  assertEquals(
    usesNode20Cspell(
      "other/action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
    ),
    false,
  );
  assertEquals(
    usesNode20Cspell(
      "actions/checkout@e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
    ),
    false,
  );
  assertEquals(usesNode20Cspell("./.github/actions/local"), false);
});

Deno.test("scanCspell lists a node20 pin and counts every reference", () => {
  const node20 = "streetsidesoftware/cspell-action@" +
    "e464ae97d348eb3beb0c5a6296dc4388ad4484d9";
  const node24 = "streetsidesoftware/cspell-action@" +
    "ce1816e4ce36532956ac6e983737392774b6e169";
  const doc = parse(
    `jobs:\n  a:\n    steps:\n      - uses: ${node20}\n      - uses: ${node24}\n      - uses: actions/checkout@v6\n`,
  );
  assertEquals(scanCspell([["wf.yml", doc]]), {
    checked: 2,
    offenders: [`wf.yml: ${node20} (v6.11.1)`],
  });
  assertEquals(scanCspell([["empty.yml", {}]]), {
    checked: 0,
    offenders: [],
  });
});

Deno.test("no workflow pins streetsidesoftware/cspell-action to a node20 runtime release", async () => {
  const { checked, offenders } = scanCspell(await loadWorkflowDocs());

  assert(
    checked > 0,
    "no streetsidesoftware/cspell-action references found; scan is vacuous",
  );
  assertEquals(
    offenders,
    [],
    "streetsidesoftware/cspell-action must be on a node24 release, e.g. v9.2.0",
  );
});
