/**
 * Detects workflows that pin softprops/action-gh-release to a release running
 * on the node20 Actions runtime, which GitHub removed on 2026-09-16
 * (issue #106). Used by test/ActionPins.ts.
 *
 * @module
 */
import { parse } from "@std/yaml";

/**
 * softprops/action-gh-release commit SHAs whose `action.yml` declares
 * `using: node20`, a runtime GitHub removed on 2026-09-16 (issue #106).
 * Verified with `gh api repos/softprops/action-gh-release/commits/<tag> --jq .sha`.
 */
export const NODE20_GH_RELEASE_SHAS: ReadonlyMap<string, string> = new Map([
  ["3bb12739c298aeb8a4eeaf626c5b8d85266b0e65", "v2.6.2"],
]);

/** True when `uses` pins softprops/action-gh-release to a node20-runtime release. */
export function usesNode20GhRelease(uses: string): boolean {
  const [action, ref] = uses.split("@");
  return action === "softprops/action-gh-release" &&
    NODE20_GH_RELEASE_SHAS.has(ref ?? "");
}

/** Every `uses:` reference (step-level and job-level) in a parsed workflow. */
export function usesRefs(doc: unknown): string[] {
  // deno-lint-ignore no-explicit-any
  const jobs = Object.values((doc as any)?.jobs ?? {}) as any[];
  return jobs.flatMap((job) => [
    ...(typeof job?.uses === "string" ? [job.uses] : []),
    ...((job?.steps ?? []) as Array<Record<string, unknown>>)
      .map((step) => step.uses)
      .filter((uses): uses is string => typeof uses === "string"),
  ]);
}

/**
 * Scan one parsed workflow for softprops/action-gh-release references.
 * `checked` counts every such reference; `offenders` lists the node20 ones.
 */
export function scanGhRelease(
  file: string,
  doc: unknown,
): { checked: number; offenders: string[] } {
  let checked = 0;
  const offenders: string[] = [];
  for (const uses of usesRefs(doc)) {
    const [action, ref] = uses.split("@");
    if (action !== "softprops/action-gh-release") continue;
    checked++;
    if (usesNode20GhRelease(uses)) {
      offenders.push(`${file}: ${uses} (${NODE20_GH_RELEASE_SHAS.get(ref)})`);
    }
  }
  return { checked, offenders };
}

/** Aggregate `scanGhRelease` over workflow texts keyed by file name. */
export function scanGhReleaseFiles(
  texts: ReadonlyMap<string, string>,
): { checked: number; offenders: string[] } {
  let checked = 0;
  const offenders: string[] = [];
  for (const [file, text] of texts) {
    const result = scanGhRelease(file, parse(text));
    checked += result.checked;
    offenders.push(...result.offenders);
  }
  return { checked, offenders };
}

/** Problems found scanning workflow texts: a vacuous scan, or node20 pins. */
export function ghReleaseScanProblems(
  texts: ReadonlyMap<string, string>,
): string[] {
  const { checked, offenders } = scanGhReleaseFiles(texts);
  const problems: string[] = [];
  if (checked === 0) {
    problems.push(
      "no softprops/action-gh-release references found; scan is vacuous",
    );
  }
  return [...problems, ...offenders];
}

/** Read every workflow file into a map keyed by file path. */
export async function readWorkflowTexts(
  files: readonly string[],
): Promise<Map<string, string>> {
  const texts = new Map<string, string>();
  for (const file of files) {
    texts.set(file, await Deno.readTextFile(file));
  }
  return texts;
}
