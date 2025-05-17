/**
 * @module
 *
 * Helpers for working with TAGS
 *
 * This module provides various utilities and classes to facilitate the addition, removal, and management of tags in JSON objects.
 *
 * @example
 * ```ts
 * import { addTag, removeTag,type TagsInterface } from "./mod.ts";
 *
 * const taggable: TagsInterface = { tags: undefined };
 *
 * assert(getTag(taggable, "hello") == null, "should not have tags yet");
 *
 * addTag(taggable, "hello", "world");
 * assert(getTag(taggable, "hello") == "world", "Expecting a value.");
 * const v = removeTag(taggable, "hello");
 * assert(v == "world", "should have removed world was: " + v);
 * assert(getTag(taggable, "hello") == null, "should no longer have tags");
 * ```
 */

/**
 * Class to process JSON files in a directory and add tags to each JSON object.
 *
 * @class
 */
export { TagAndRelease } from "./src/TagAndRelease.ts";

/**
 * Interface defining the structure of a tag.
 *
 * @property {string} name - The name of the tag.
 * @property {string} value - The value of the tag.
 */
export type { TagInterface } from "./src/TagInterface.ts";

/**
 * Function to add a tag to a taggable entity.
 *
 * @function
 * @param {TagsInterface} taggable - The entity to which the tag will be added.
 * @param {string} name - The name of the tag.
 * @param {string} value - The value of the tag.
 * @returns {string | null} The previous value of the tag if it was updated, or null if it was added.
 */
export { addTag, addTags, getTag, removeTag } from "./src/TagsInterface.ts";

/**
 * Interface defining an entity that can have tags.
 *
 * @property {TagInterface[]} [tags] - Array of tags associated with the entity.
 */
export type { TagsInterface } from "./src/TagsInterface.ts";