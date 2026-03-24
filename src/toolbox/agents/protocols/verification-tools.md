# Verification Tools Protocol

Guidelines for build verification, test execution, and failure handling.

## Build Verification

### Auto-Detection

The build command is auto-detected from `package.json` scripts in this priority:

1. `check` (if exists -- usually includes type checking)
2. `typecheck` (TypeScript projects)
3. `build` (general build)

Override via settings: `verification.buildCommand`.

### Execution

```bash
# TypeScript/JavaScript (Bun)
bun run build

# Python (uv)
uv run pytest

# Java (Gradle)
./gradlew test

# Go
go build ./... && go test ./...
```

### Timeout

Default: 30 seconds (`verification.buildTimeoutMs`). Long builds should increase this in settings.

## Test Execution

### Framework Detection

| File Pattern | Framework | Command |
|---|---|---|
| `*.test.ts`, `*.spec.ts` | Bun/Jest | `bun test` |
| `*_test.py`, `test_*.py` | pytest | `uv run pytest` |
| `*_test.go` | Go test | `go test ./...` |
| `*.test.java` | JUnit | `./gradlew test` |

### Test Scope

- Run **affected tests only** when possible: `bun test <changed-file>`
- Fall back to full suite if unclear which tests are affected
- Never skip tests silently -- report skipped count

## Failure Handling

### Build Failure

1. Read the error output (first 50 lines)
2. Identify the failing file and line
3. Common patterns:
   - Type error: fix the type annotation
   - Import error: check file paths and exports
   - Syntax error: check for unclosed brackets, missing semicolons
4. Fix and re-run before marking task done

### Test Failure

1. Read the failing test assertion
2. Identify expected vs received
3. Determine if the test or the code is wrong
4. Fix root cause, not symptoms
5. Re-run the specific failing test, then full suite

### Lint Failure

1. Auto-fix when possible: `bun run lint --fix`
2. Manual fix for structural issues
3. Never suppress lint rules unless explicitly told

## Verification Score

Tasks are scored on 4 criteria:
- **Build check**: Does the build pass?
- **Git diff**: Were changes actually made?
- **Summary quality**: Is the completion summary substantive?
- **AC match**: Does the summary reference acceptance criteria keywords?

Score >= 0.7 passes verification. Below 0.7 goes to review.
