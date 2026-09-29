/**
 * Builds a CycloneDX 1.5 JSON SBOM from the resolved dependency graph of every
 * export in deno.json, via `deno info --json` (issue #57).
 *
 * Output is deterministic (no timestamp or serial number, sorted components)
 * so two releases' SBOMs diff cleanly.
 *
 * Usage: deno run --allow-read=deno.json --allow-run=deno tools/Sbom.ts > sbom.cdx.json
 *
 * @module
 */

/** One CycloneDX component. */
export interface SbomComponent {
  type: "library";
  "bom-ref": string;
  name: string;
  version: string;
  purl: string;
}

/** The subset of a CycloneDX 1.5 document this tool emits. */
export interface CycloneDx {
  bomFormat: "CycloneDX";
  specVersion: "1.5";
  version: 1;
  metadata: { component: SbomComponent };
  components: SbomComponent[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Scoped names follow the npm purl form: `@scope/name` → `%40scope/name`.
function component(
  ecosystem: "jsr" | "npm",
  name: string,
  version: string,
): SbomComponent {
  if (!name || !version) {
    throw new Error(`SBOM component needs a name and version: '${name}'`);
  }
  const purl = `pkg:${ecosystem}/${name.replace(/^@/, "%40")}@${version}`;
  return { type: "library", "bom-ref": purl, name, version, purl };
}

/** Split a resolved `@scope/name@1.2.3` spec at its version separator. */
function splitSpec(spec: string): [string, string] {
  const at = spec.lastIndexOf("@");
  if (at <= 0) throw new Error(`unresolved package spec '${spec}'`);
  return [spec.slice(0, at), spec.slice(at + 1)];
}

function graphComponents(info: unknown): SbomComponent[] {
  if (!isRecord(info)) {
    throw new Error("deno info output must be a JSON object");
  }
  const found: SbomComponent[] = [];
  const jsr = info.packages ?? {};
  if (!isRecord(jsr)) throw new Error("deno info 'packages' must be an object");
  for (const resolved of Object.values(jsr)) {
    found.push(component("jsr", ...splitSpec(String(resolved))));
  }
  const npm = info.npmPackages ?? {};
  if (!isRecord(npm)) {
    throw new Error("deno info 'npmPackages' must be an object");
  }
  for (const [key, pkg] of Object.entries(npm)) {
    if (
      !isRecord(pkg) || typeof pkg.name !== "string" ||
      typeof pkg.version !== "string"
    ) {
      throw new Error(`malformed npm package '${key}' in deno info output`);
    }
    found.push(component("npm", pkg.name, pkg.version));
  }
  return found;
}

/** Merge `deno info --json` graphs into one CycloneDX document for a package. */
export function toCycloneDx(
  name: string,
  version: string,
  infos: unknown[],
): CycloneDx {
  const unique = new Map<string, SbomComponent>();
  for (const c of infos.flatMap(graphComponents)) unique.set(c.purl, c);
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: { component: component("jsr", name, version) },
    components: [...unique.values()].sort((a, b) =>
      a.purl < b.purl ? -1 : a.purl > b.purl ? 1 : 0
    ),
  };
}

/** Every module path published through deno.json `exports`, sorted. */
export function exportRoots(config: Record<string, unknown>): string[] {
  const exports = config.exports;
  const roots = typeof exports === "string"
    ? [exports]
    : isRecord(exports)
    ? Object.values(exports)
    : [];
  if (roots.length === 0 || roots.some((r) => typeof r !== "string" || !r)) {
    throw new Error("deno.json 'exports' must name one or more module paths");
  }
  return (roots as string[]).sort();
}

async function denoInfo(root: string): Promise<unknown> {
  const { code, stdout, stderr } = await new Deno.Command("deno", {
    args: ["info", "--json", root],
    stdin: "null",
  }).output();
  if (code !== 0) {
    throw new Error(
      `deno info ${root} failed (${code}): ${new TextDecoder().decode(stderr)}`,
    );
  }
  return JSON.parse(new TextDecoder().decode(stdout));
}

if (import.meta.main) {
  const config = JSON.parse(await Deno.readTextFile("deno.json"));
  const infos = await Promise.all(exportRoots(config).map(denoInfo));
  const bom = toCycloneDx(config.name, config.version, infos);
  console.log(JSON.stringify(bom, null, 2));
}
