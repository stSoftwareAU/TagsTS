// These guards are themselves tests. Exercise their failure behavior in an
// isolated child suite, so removing a guard assertion cannot silently pass CI.
// Only the named guard runs in each probe; the repository workflows stay intact.
import { assert, assertEquals } from "@std/assert";
// A discoverable Deno test entry also makes the dependency suites explicit.
import "./ActionPins.ts";
import "./SpellcheckWorkflow.ts";
import "./WorkflowGuardSuite.ts";

const MODULES = [
  "ActionPins.ts",
  "SpellcheckWorkflow.ts",
  "WorkflowGuardSuite.ts",
];
const CHECKOUT = "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd";
const CSPELL =
  "streetsidesoftware/cspell-action@6f3c77c1406bc930f944ba97e9801a22e42caf58";
const OLD_CSPELL =
  "streetsidesoftware/cspell-action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9";

function workflow(uses = [CHECKOUT, CSPELL]): string {
  return JSON.stringify({
    jobs: {
      spellcheck: {
        steps: uses.map((uses) => ({
          uses,
          with: {
            files: "**/*.{md,html,js,ts,css}",
            config: ".github/workflows/cspell.json",
          },
        })),
      },
    },
  });
}

// Supply a known faulty helper to test whether its unit test detects it.
// The public signature is the injection boundary; no assertion is rewritten.
function faultyHelper(source: string, name: string, statement: string): string {
  const signature = `export function ${name}(uses: string): boolean {`;
  assert(source.includes(signature), `missing helper ${name}`);
  return source.replace(signature, `${signature}\n  ${statement}`);
}

// The probes spawn child `deno test` processes, and a child Deno process holds
// its own permissions, so `--allow-run` would void the least-privilege test
// step in quality.yml (Issue #38). CI therefore runs without it and this suite
// is reported as ignored there; `quality.sh` runs it with --allow-all.
const canSpawn =
  (await Deno.permissions.query({ name: "run" })).state === "granted";

Deno.test({
  name: "workflow guards reject invalid fixtures and faulty helpers",
  ignore: !canSpawn,
  fn: async (t) => {
    const sources = new Map<string, string>();
    for (const name of MODULES) {
      sources.set(
        name,
        await Deno.readTextFile(new URL(name, import.meta.url)),
      );
    }
    const directory = await Deno.makeTempDir({ prefix: "workflow-guard-" });
    try {
      await Deno.mkdir(`${directory}/test`);
      await Deno.mkdir(`${directory}/.github/workflows`, { recursive: true });
      await Deno.copyFile("deno.json", `${directory}/deno.json`);

      const probe = async (
        name: string,
        module: string,
        test: string,
        options: {
          source?: string;
          document?: string;
          error?: string;
        } = {},
      ): Promise<void> => {
        await t.step(name, async () => {
          for (const [file, source] of sources) {
            await Deno.writeTextFile(
              `${directory}/test/${file}`,
              file === module ? options.source ?? source : source,
            );
          }
          await Deno.writeTextFile(
            `${directory}/.github/workflows/spellcheck.yaml`,
            options.document ?? workflow(),
          );
          const result = await new Deno.Command(Deno.execPath(), {
            args: [
              "test",
              "--cached-only",
              "--allow-read",
              "--no-check",
              "--filter",
              test,
              `test/${module}`,
            ],
            cwd: directory,
            env: { NO_COLOR: "1" },
            stdout: "piped",
            stderr: "piped",
          }).output();
          const output = new TextDecoder().decode(result.stdout) +
            new TextDecoder().decode(result.stderr);
          assertEquals(
            result.code,
            1,
            `${name}: guard accepted fault\n${output}`,
          );
          assert(output.includes("1 failed"), output);
          if (options.error) assert(output.includes(options.error), output);
        });
      };

      const actionSource = sources.get("ActionPins.ts")!;
      await probe(
        "known-node20 test rejects a helper that misses every SHA",
        "ActionPins.ts",
        "usesNode20Action flags each known node20 SHA of each guarded action",
        {
          source: faultyHelper(
            actionSource,
            "usesNode20Action",
            "return false;",
          ),
        },
      );
      await probe(
        "issue-104 test rejects a helper that misses the old cspell SHA",
        "ActionPins.ts",
        "usesNode20Action flags the cspell-action v6.11.1 pin from issue #104",
        {
          source: faultyHelper(
            actionSource,
            "usesNode20Action",
            "return false;",
          ),
        },
      );
      for (
        const uses of [
          CSPELL,
          "streetsidesoftware/cspell-action@11d5960a326750d5838078e36cf38b85af677262",
          "other/action@e464ae97d348eb3beb0c5a6296dc4388ad4484d9",
          "./.github/actions/local",
        ]
      ) {
        await probe(
          `acceptance test rejects a false positive for ${uses}`,
          "ActionPins.ts",
          "usesNode20Action accepts node24 cspell-action and mismatched action/SHA pairs",
          {
            source: faultyHelper(
              actionSource,
              "usesNode20Action",
              `if (uses === ${JSON.stringify(uses)}) return true;`,
            ),
          },
        );
      }
      for (const missing of [CHECKOUT, CSPELL]) {
        await probe(
          `scan rejects a workflow missing ${missing.split("@")[0]}`,
          "ActionPins.ts",
          "no workflow pins a guarded action to a node20 runtime release",
          {
            document: workflow(
              [CHECKOUT, CSPELL].filter((uses) => uses !== missing),
            ),
            error: "scan is vacuous",
          },
        );
      }
      await probe(
        "scan collects a node20 cspell offender",
        "ActionPins.ts",
        "no workflow pins a guarded action to a node20 runtime release",
        { document: workflow([CHECKOUT, OLD_CSPELL]), error: OLD_CSPELL },
      );
      await probe(
        "scan collects a node20 checkout offender",
        "ActionPins.ts",
        "no workflow pins a guarded action to a node20 runtime release",
        {
          document: workflow([
            "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
            CSPELL,
          ]),
          error: "v4.4.0",
        },
      );
      await probe(
        "workflow pin test rejects a tag",
        "SpellcheckWorkflow.ts",
        "spellcheck job runs cspell-action pinned to a commit SHA",
        {
          document: workflow([CHECKOUT, "streetsidesoftware/cspell-action@v9"]),
        },
      );
      await probe(
        "workflow version test rejects a missing comment",
        "SpellcheckWorkflow.ts",
        "spellcheck cspell-action version comment names major version 8 or later",
        { error: "cspell-action uses: line must end" },
      );
      await probe(
        "workflow version test rejects a node20 version comment",
        "SpellcheckWorkflow.ts",
        "spellcheck cspell-action version comment names major version 8 or later",
        {
          document:
            `jobs:\n  spellcheck:\n    steps:\n      - uses: ${CSPELL} # v6.11.1\n`,
          error: "must be v8.0.0 or later",
        },
      );
      for (
        const [field, value] of [["files", "**/*.md"], ["config", "other.json"]]
      ) {
        await probe(
          `workflow inputs test rejects changed ${field}`,
          "SpellcheckWorkflow.ts",
          "spellcheck cspell-action step keeps its files and config inputs",
          {
            document: workflow().replaceAll(
              JSON.stringify(
                field === "files"
                  ? "**/*.{md,html,js,ts,css}"
                  : ".github/workflows/cspell.json",
              ),
              JSON.stringify(value),
            ),
            error: `cspell ${field} input must be preserved`,
          },
        );
      }
      for (const helper of ["isPinned", "usesNode20Action"]) {
        // Inject the helper fault into the dependency of the importing suite.
        sources.set(
          "ActionPins.ts",
          faultyHelper(actionSource, helper, "return false;"),
        );
        await probe(
          `importing suite rejects a faulty ${helper}`,
          "WorkflowGuardSuite.ts",
          "guarded actions include checkout and cspell-action",
        );
        sources.set("ActionPins.ts", actionSource);
      }
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  },
});
