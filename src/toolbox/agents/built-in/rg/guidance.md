# rg -- Exhaustive Text Search (ripgrep)

Use `rg` (via host Grep tool) for exhaustive text/regex search across the codebase. Language-agnostic, handles any file type.

## Output Modes

| Mode | Purpose |
|---|---|
| `files_with_matches` | List file paths (cheapest, use first) |
| `count` | Match counts per file |
| `content` | Show matching lines with context |

Always start with `files_with_matches` or `count` before escalating to `content`.

## Key Parameters

| Parameter | Purpose |
|---|---|
| `glob: "*.ts"` | Filter to file patterns |
| `type: "py"` | Filter to known file types |
| `head_limit` | Cap output size (always set when exploring) |
| `-C` / `-A` / `-B` | Context lines around matches |
| `multiline: true` | Cross-line pattern matching |
| `-i: true` | Case-insensitive search |

## When to Use rg

- All occurrences of a string or regex pattern
- Non-code content (logs, configs, prose, data, .env)
- Secret/credential scanning
- Cross-language search
- File-type or glob-scoped search

## Escalation Ladder

`files_with_matches` --> `count` --> `content -C 2` --> `content -C 5` --> tilth for full file. Stop at the first level with enough information.
