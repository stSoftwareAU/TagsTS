// Verifies the code snippets shown in README.md compile and behave as
// documented. If the README examples change, update this file in lockstep so
// the documentation stays accurate (issue #24).

import { assertEquals } from "@std/assert";
import {
  addTag,
  addTags,
  getTag,
  removeTag,
  type TagsInterface,
} from "../src/TagsInterface.ts";
import { TagAndRelease } from "../src/TagAndRelease.ts";

Deno.test("README - basic tag operations", () => {
  const taggable: TagsInterface = {};

  assertEquals(addTag(taggable, "hello", "world"), null);
  assertEquals(addTag(taggable, "hello", "there"), "world");
  assertEquals(getTag(taggable, "hello"), "there");
  assertEquals(removeTag(taggable, "hello"), "there");
  assertEquals(getTag(taggable, "hello"), null);
});

Deno.test("README - merging tags from another object", () => {
  const source: TagsInterface = {};
  addTag(source, "category", "electronics");
  addTag(source, "price", "99.99");

  const target: TagsInterface = {};
  addTag(target, "keep", "me");

  addTags(target, source);

  assertEquals(getTag(target, "category"), "electronics");
  assertEquals(getTag(target, "price"), "99.99");
  assertEquals(getTag(target, "keep"), "me");
});

Deno.test("README - TagAndRelease programmatic usage", async () => {
  const dir = await Deno.makeTempDir({ prefix: "readme_tar_" });
  try {
    Deno.writeTextFileSync(`${dir}/a.json`, JSON.stringify({ existing: 1 }));

    new TagAndRelease().process({
      directory: dir,
      tagList: "ABC=XYZ,HELLO=World",
    });

    const tagged = JSON.parse(Deno.readTextFileSync(`${dir}/a.json`));
    assertEquals(getTag(tagged, "ABC"), "XYZ");
    assertEquals(getTag(tagged, "HELLO"), "World");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
