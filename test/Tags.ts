import { assert, assertEquals } from "@std/assert";
import {
  addTag,
  addTags,
  getTag,
  removeTag,
  type TagsInterface,
} from "../src/TagsInterface.ts";

((globalThis as unknown) as { DEBUG: boolean }).DEBUG = true;

Deno.test("tag", () => {
  const taggable: TagsInterface = { tags: undefined };

  assert(getTag(taggable, "hello") == null, "should not have tags yet");

  addTag(taggable, "hello", "world");
  assert(getTag(taggable, "hello") == "world", "Expecting a value.");
  const v = removeTag(taggable, "hello");
  assert(v == "world", "should have removed world was: " + v);
  assert(getTag(taggable, "hello") == null, "should no longer have tags");
});

Deno.test("tags", () => {
  const source: TagsInterface = { tags: undefined };

  addTag(source, "hello", "world");
  addTag(source, "good", "bye");

  const target: TagsInterface = { tags: undefined };

  addTag(target, "keep", "me");

  addTags(target, source);

  assert(getTag(target, "hello") == "world", "Expecting a value.");

  assert(getTag(target, "keep") == "me", "Keep the original.");
});

Deno.test("Remove", () => {
  const taggable: TagsInterface = {};

  for (let i = 0; i < 10; i++) {
    addTag(taggable, `t${i}`, `v${i}`);
  }
  addTag(taggable, "middle", "something");

  for (let i = 10; i < 20; i++) {
    addTag(taggable, `t${i}`, `v${i}`);
  }
  checkIt(taggable);

  removeTag(taggable, "middle");
  checkIt(taggable);
});

function checkIt(taggable: TagsInterface) {
  for (let i = 0; i < 20; i++) {
    const value = getTag(taggable, `t${i}`);
    assertEquals(`v${i}`, value);
  }
}
