## Summary

Rewrote `README.md` so it matches the actual exported API and added a test suite
(`test/ReadmeExamples.ts`) that runs every code snippet from the README to keep
documentation and behaviour in lockstep. Closes #24.

Key documentation fixes:

- Corrected the `addTags` signature — it takes a _source_ `TagsInterface`, not a
  `TagInterface[]`. The previous example would not have compiled.
- Documented the `TagAndRelease` class (exported from `mod.ts` but previously
  undocumented).
- Updated the installation snippet to use `deno add jsr:@stsoftware/tags` and
  the `@stsoftware/tags/mod` entry point that matches `deno.json`.
- Added a tabular API reference, a programmatic `TagAndRelease` example, and a
  short Mermaid diagram showing how the pieces fit together.

## Evidence

Backend/library change — no UI to screenshot. The README examples are now
verified by `test/ReadmeExamples.ts`; `./quality.sh` runs cleanly (12 passed, 0
failed).

```mermaid
flowchart LR
    A[Your object<br/>TagsInterface] -- addTag / addTags --> B[(tags: TagInterface[])]
    B -- getTag --> C[value or null]
    B -- removeTag --> D[removed value or null]
    E[JSON files in directory] -- TagAndRelease.process --> B
```

## Test Plan

- Added `test/ReadmeExamples.ts` with three tests that exercise each README
  snippet against the real exported functions:
  - `README - basic tag operations` — covers `addTag`/`getTag`/`removeTag` and
    the replace-returns-previous-value behaviour.
  - `README - merging tags from another object` — covers the corrected
    `addTags(target, source)` signature, including the preserve-existing-tag
    case.
  - `README - TagAndRelease programmatic usage` — invokes
    `new TagAndRelease().process(...)` against a temp directory and asserts the
    tags land on disk.
- Existing tests (`test/Tags.ts`, `test/TagAndRelease.ts`,
  `test/MarkdownLintWorkflow.ts`, `test/ShellCheckWorkflow.ts`) are unchanged
  and continue to pass.
- Full quality gate: `./quality.sh` → `ok | 12 passed | 0 failed`.
