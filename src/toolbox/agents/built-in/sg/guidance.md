# sg -- AST-Aware Code Patterns (ast-grep)

Use `sg` for structural code search and rewrite. Matches AST nodes, not text -- no false positives from comments/strings.

## Key Commands

| Command | Purpose |
|---|---|
| `sg run -p '<pattern>' --lang <lang>` | Search for AST pattern |
| `sg run -p '<old>' -r '<new>' --lang <lang>` | Structural search and rewrite |
| `sg run -p '<pattern>' --json --lang <lang>` | Machine-readable match output |

## Pattern Syntax

- `$NAME` -- matches any single AST node (wildcard)
- `$$$ARGS` -- matches zero or more nodes (variadic)
- Patterns must be valid code in the target language
- Examples: `fetch($URL, $$$OPTS)`, `useState($INIT)`, `if ($COND) { $$$BODY }`

## When to Use sg

- Find specific code patterns (call sites, API usage)
- Structural refactoring (rewrite patterns safely)
- Anti-pattern / lint detection
- Match code structure, not text (ignores comments/strings)

## When NOT to Use sg

- Non-code files (logs, configs, prose)
- Simple string search (use rg)
- Cross-statement patterns (`await $A; await $B` fails -- use rg multiline)
- Regex patterns that don't map to code structure

## Important Limitations

ast-grep matches within one AST node only. It cannot match across sibling statements. For sequential statement patterns, use rg with `multiline: true`.
