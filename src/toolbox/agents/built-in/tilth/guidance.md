# tilth -- Structure-Aware Code Navigation

Use `tilth` for reading code and navigating project structure. It understands code semantics (functions, classes, imports) and manages token budgets automatically.

## Key Commands

| Command | Purpose |
|---|---|
| `tilth <query> --scope <dir>` | Search for symbols, content, or patterns |
| `tilth <path>` | Read a file (smart: full if small, outline if large) |
| `tilth <path> --section <start>-<end>` | Read exact line range |
| `tilth --map --scope <dir>` | Structural codebase overview |
| `tilth <query> --budget <tokens>` | Cap output to fit context budget |

## When to Use tilth

- Symbol/definition lookup (function, class, type)
- Reading source files with automatic token management
- Structural overview / API surface discovery
- File path discovery by glob pattern

## When NOT to Use tilth

- Complex regex patterns (use rg instead)
- Non-code content: logs, configs, prose, data (use rg)
- Secret/credential scanning (use rg)
- AST-aware structural matching (use sg)

## Token Budget

tilth auto-manages output size. Files under ~6000 tokens show full content; larger files get structural outlines. Use `--budget <tokens>` to explicitly cap output.
