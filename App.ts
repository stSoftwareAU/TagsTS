import { parseArgs } from "https://deno.land/std@0.212.0/cli/parse_args.ts";
import { TagAndRelease } from "./src/TagAndRelease.ts";

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
