/**
 * @module
 *
 * Command line application to tag JSON files in a directory.
 *
 * Reads the `--directory` and `--tagList` arguments and applies the
 * supplied tags to every JSON file in the given directory.
 *
 * @example
 * ```bash
 * deno run --allow-read --allow-write jsr:@stsoftware/tags/App \
 *   --directory ./build --tagList "version=1.0.0,release=stable"
 * ```
 */
import { parseArgs } from "@std/cli";
import { TagAndRelease } from "./src/TagAndRelease.ts";

/**
 * Entry point for the command line application.
 *
 * Parses the command line arguments and processes the JSON files in the
 * specified directory, adding the supplied tags to each JSON object.
 * Exits with a non-zero status if the required `--directory` or
 * `--tagList` arguments are missing.
 */
export function main() {
  const args = parseArgs(Deno.args);

  if (!args.directory) {
    console.warn("--directory is required.");
    Deno.exit(1);
  }

  if (!args.tagList) {
    console.warn("--tagList is required.");
    Deno.exit(1);
  }

  const tagAndRelease = new TagAndRelease();

  tagAndRelease.process({
    directory: args.directory,
    tagList: args.tagList,
  });
}

if (import.meta.main) {
  main();
}
