# Code Intelligence Protocol

Adaptive tool guidance for code navigation, search, and structural analysis.
Sections are conditionally included based on installed tools.

## Tool Selection Matrix

<!-- [if:tilth,rg,sg] All three tools available -->
| Task | Primary Tool | Fallback |
|---|---|---|
| Symbol/definition lookup | tilth | rg files_with_matches |
| Read source file | tilth | host Read (only if editing) |
| All occurrences of string | rg count/files_with_matches | - |
| Code pattern matching | sg run -p | rg content |
| Structural refactoring | sg run -p -r | manual Edit |
| Non-code content search | rg | - |
| Codebase overview | tilth --map | rg + manual exploration |

<!-- [if:rg,!tilth] ripgrep only (no tilth) -->
<!-- Use rg for all search. Use host Read for file reading. -->

<!-- [if:!rg,!sg] Minimal tooling -->
<!-- Use host Grep and Read tools. No structural matching available. -->

## Chain Protocol

When multiple tools are available, pipeline them sequentially -- each tool's output narrows the next tool's input.

### SCOUT (rg) --> SURGEON (sg) --> ANALYST (tilth)

1. **SCOUT (rg)**: Cast the wide net. `count` or `files_with_matches` to establish scope.
2. **SURGEON (sg)**: Classify structurally. Use the file list from step 1 to scope `sg run`. Separate real code from imports/comments/strings.
3. **ANALYST (tilth)**: Read only what matters. Use narrowed results to read specific lines for context.
4. **SURGEON (sg)**: Rewrite if needed. `sg run -p 'old' -r 'new'` for structural changes.
5. **SCOUT (rg)**: Verify. `count` old pattern (expect 0) + new pattern (expect N).

### Chain Rules

- Never hedge counts. If rg says 22 and you suspect imports inflate it, use sg to get exact call-site count.
- Cross-validate between tools. If two tools disagree on count, investigate.
- Each step narrows scope. Step 2 scoped by step 1's file list. Step 3 reads only files from step 2.
- Skip steps that add no value. Read-only analysis skips rewrite+verify.
- Parallel is OK for independent sub-questions, not for the same pipeline.

## Token Budget Rules

1. Cheapest mode first: rg `files_with_matches` or `count` before `content`.
2. Cap output: always use `head_limit` on rg. Use `--budget` on tilth.
3. Narrow scope early: `--scope <dir>` on tilth, `glob:`/`type:` on rg.
4. One round, not three: run independent tools in parallel.
5. Don't re-read: if tilth already showed code, don't Read the same section.

## Fallback Strategies

### Without tilth
Use host Read for file reading, host Glob for file discovery. rg handles all search. No structural overview available -- rely on directory listing + rg patterns.

### Without sg
rg handles pattern matching with `content` mode. Structural accuracy is lower -- expect false positives from comments/strings. Use `-C` context for manual classification.

### Without rg
tilth handles search + reading. No regex support. Use `tilth <query> --scope <dir>` for broad search, tilth `--section` for targeted reads.

### Minimal (no specialized tools)
Use host Grep (ripgrep equivalent) and host Read. No structural matching. No token budget management. Explore manually.
