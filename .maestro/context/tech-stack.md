# Tech Stack

## Languages
- TypeScript
- Markdown
- YAML
- JSON

## Frameworks and Libraries
- Bun for runtime, package management, test execution, and compilation
- `citty` for CLI command definition
- `simple-git` for git integration

## Architecture
- Clean architecture: `commands -> usecases -> ports <- adapters`
- Module-level service wiring through `src/services.ts`
- Standalone binary build targeting `dist/maestro`

## Tools and Infrastructure
- Package manager: Bun
- Runtime: Bun
- Version control: Git with worktree-based task isolation
- Task backend: `br` / beads (optional integration)
- CI/CD: GitHub Actions (`.github/workflows/ci.yml`)
- Build entrypoint: `bun run build`
- Test runner: `bun test`

## Testing Stack
- `bun:test` for unit and e2e coverage
- Temp-repo e2e harness under `src/__tests__/e2e/`
- Repo verification centered on build plus test pass, not a separate lint step
