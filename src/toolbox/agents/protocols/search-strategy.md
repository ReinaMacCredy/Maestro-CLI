# Search Strategy Protocol

Guidelines for efficient codebase search operations. Use the chain protocol to minimize token usage.

## Tool Selection

| Task | Primary Tool | When to Escalate |
|------|-------------|-----------------|
| Find files by name/pattern | `tilth "<glob>" --scope <dir>` | If tilth returns nothing, try host Grep with `files_with_matches` |
| Find text in files | Host Grep (`files_with_matches` first, then `content`) | If too many results, narrow with `glob:` or `type:` filters |
| Find code patterns | `sg run -p '<pattern>' --lang <lang>` | If ast-grep can't match (non-code files), fall back to Grep |
| Read specific code | `tilth <path>` or `tilth <path> --section <start>-<end>` | If file is too large, use `--budget <tokens>` |

## Chain Protocol: SCOUT -> SURGEON -> ANALYST

Each step narrows the next. Never scatter all three in parallel on the same pipeline.

1. **SCOUT (Grep)**: Cast the wide net. `count` or `files_with_matches` first. This is cheap.
2. **SURGEON (ast-grep)**: Classify structurally. Use the file list from step 1.
3. **ANALYST (tilth)**: Read only what matters. Use narrowed results from step 2.

## Token Budget Rules

1. **Cheapest mode first**: `files_with_matches` before `content`
2. **Cap output**: Always use `head_limit` when exploring (start with 20)
3. **Narrow scope early**: Pass `--scope <dir>` or `glob:`/`type:` filters
4. **One round, not three**: Run independent searches in parallel, dependent searches in sequence
5. **Don't re-read**: If tilth already showed the code, don't Read the same section

## Escalation Ladder

```
files_with_matches -> count -> content -C 2 -> content -C 5 -> tilth --section -> tilth --full
```

Stop at the first level that gives enough information.

## Query Optimization

- **Exact match**: Use literal strings, not regex, when possible
- **Symbol lookup**: `tilth <name> --scope <dir>` (structure-aware, faster than grep)
- **Cross-language**: Host Grep is language-agnostic; use when searching configs, logs, prose
- **Negation**: `files_with_matches` all files, diff against pattern matches
