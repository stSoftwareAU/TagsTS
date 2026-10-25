// Guards the softprops/action-gh-release pin in
// .github/workflows/github-release.yml (issue #106). Importing
// test/GhReleasePins.ts also runs its own guard tests here, so a mutation of a
// changed line in it turns a test in this file red.
import { assert } from "@std/assert";
import "./GhReleasePins.ts";

Deno.test("github-release.yml keeps the SHA pin with a v3 version comment", async () => {
  const text = await Deno.readTextFile(".github/workflows/github-release.yml");
  assert(
    /uses: softprops\/action-gh-release@[0-9a-f]{40} # v3\.\d+\.\d+/.test(text),
    "github-release.yml must pin softprops/action-gh-release to a 40-character SHA followed by a `# v3.x.y` comment",
  );
});
