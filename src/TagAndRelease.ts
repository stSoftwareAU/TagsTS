import { addTag } from "./TagsInterface.ts";

/**
 * Options for the TagAndRelease process.
 */
export interface TagAndReleaseOptions {
  /** The directory containing JSON files to be processed. */
  directory: string;
  /** A comma-separated list of tags to be added, in the format "key=value". */
  tagList: string;
}

/**
 * The TagAndRelease class provides functionality to process JSON files
 * in a specified directory, adding tags to each JSON object based on
 * the provided tag list.
 */
export class TagAndRelease {
  /**
   * Processes JSON files in the specified directory, adding tags to each JSON object.
   *
   * @param options - Options for the tagging and release process.
   */
  process(options: TagAndReleaseOptions): void {
    for (const dirEntry of Deno.readDirSync(options.directory)) {
      if (dirEntry.name.endsWith(".json")) {
        const filePath = `${options.directory}/${dirEntry.name}`;
        const json = JSON.parse(Deno.readTextFileSync(filePath));

        options.tagList.split(",").forEach((pair) => {
          const [key, value] = pair.split("=");

          addTag(json, key, value);

          Deno.writeTextFileSync(filePath, JSON.stringify(json, null, 1));
        });
      }
    }
  }
}
