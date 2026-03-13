# Coding Guidelines

## Development Principles
- Correctness over cleverness
- Smallest change that works
- Follow existing conventions before introducing new abstractions
- Preserve clean architecture boundaries
- Avoid unnecessary dependencies
- Keep user-facing failures actionable and explicit

## Repository Conventions
- TypeScript ES2022 with ESM modules
- Use semicolons and single quotes
- Use `.ts` extensions for local imports
- Prefer `import type` for type-only imports
- Use `camelCase` for functions and variables, `PascalCase` for types and classes
- Keep one command per file under `src/commands/`
- Put business rules in `src/usecases/` and depend on ports rather than adapters
- Use `output(...)` for CLI rendering and `handleCommandError(...)` for command failures
- Prefer descriptive names over shorthand

## Non-Functional Requirements
- Validate input at system boundaries, especially CLI args, filesystem state, and git state
- Never log secrets, tokens, or credentials
- Maintain predictable CLI behavior in both text and JSON output modes
- Keep build output reproducible through Bun-based scripts
- Add or update tests for new behavior and regressions
- Protect task and plan integrity so agent workflows stay resumable

## Verification Defaults
- Run `bun run build` for compile and packaging validation
- Run `bun test` for behavior validation
- When command UX changes, verify the affected command in dev mode with `bun src/cli.ts <command>`
