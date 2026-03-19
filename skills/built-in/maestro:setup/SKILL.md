---
name: maestro:setup
description: "Scaffolds project context (product, tech stack, coding guidelines, product guidelines, workflow) and initializes maestro. Use for first-time project onboarding."
argument-hint: "[--reset]"
---

# Maestro Setup -- Project Context Scaffolding

Interview the user to create persistent project context documents. These files are referenced by all `maestro:*` skills for deeper project understanding.

**Core principle:** Context files are the foundation of every maestro workflow. Inaccurate context produces inaccurate plans, tests, and implementations. Verify each file before moving on.

## Arguments

`$ARGUMENTS`

- `--reset`: Delete all existing context files and start fresh.
- Default (no args): Run setup interview. If context already exists, offer to update or skip.

---

## Step 1: Handle --reset

If `$ARGUMENTS` contains `--reset`:
1. Confirm with user before deleting `.maestro/memory/` and `.maestro/` contents
2. If confirmed: delete and report. Stop.
3. If declined: stop without changes.

## Step 2: Check Setup State (Resume Protocol)

See `reference/resume-protocol.md` for full state machine, step name registry, and skip logic.

Check whether `.maestro/` directory exists and what memory files are present. If an interrupted run is detected (partial memory files), offer resume or start over.

**Verification:** Display which steps were completed and which remain. The user must see the list before choosing.

## Step 3: Check Existing Context

_Skip if resumed past this step._

Check for existing memory files via `maestro memory-list --global` (CLI) or `maestro_memory_list` (MCP).

**If context exists:**

Ask the user: "Existing context files found. What would you like to do?"
Options:
- **Update** -- Re-run interview, preserving existing values as defaults
- **View** -- Display current context files, then ask again
- **Cancel** -- Exit without changes

**If updating:** Load existing file content and pre-fill interview answers. The user sees their current values and can accept or change them.

**If no context exists:** Continue to Step 4.

## Step 4: Detect Project Maturity

_Skip if resumed past this step._

Classify as **Brownfield** (existing code) or **Greenfield** (new project).

### Detection Logic

Check these indicators in order. If ANY brownfield indicator is true, classify as brownfield:

| Indicator | Check | Weight |
|-----------|-------|--------|
| Package manifest | `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `*.csproj` exists | Strong |
| Source directories | `src/`, `app/`, `lib/`, `cmd/` contains `.ts`/`.py`/`.go`/`.rs` files | Strong |
| Git history | `.git` exists with 5+ commits | Moderate |
| README | `README.md` exists with >10 lines | Weak (alone insufficient) |

### Brownfield Flow

1. **Check working tree.** If uncommitted changes exist, warn: "You have uncommitted changes. Setup is read-only but consider committing first."
2. **Ask scan permission.** "May I scan your codebase to pre-fill setup answers? This is read-only -- no files will be modified."
   - If denied: proceed as if greenfield (manual interview for everything).
   - If granted: continue to scan.
3. **Scan the codebase** (read-only):
   - `git ls-files | head -200` -- file structure overview
   - `README.md` -- project description, features
   - Package manifests (`package.json`, `Cargo.toml`, etc.) -- dependencies, scripts
   - `CLAUDE.md` / `.cursor/rules` / `.windsurfrules` -- existing coding conventions
   - Linter configs (`.eslintrc*`, `ruff.toml`, `.prettierrc*`, `biome.json`) -- style rules
   - `tsconfig.json` / `tsc` config -- language settings
   - `Dockerfile` / `docker-compose.yml` -- infrastructure
   - CI configs (`.github/workflows/`, `.gitlab-ci.yml`) -- build/deploy info
4. **Store inferences** in memory for pre-filling interview answers. Do NOT write any files yet.
5. **Report what was inferred.** Show the user a summary: "Based on scanning, I detected: {languages}, {frameworks}, {tools}. I'll use these as defaults in the interview."

### Greenfield Flow

1. Announce: "New project detected. I'll walk you through defining it from scratch."
2. If no `.git/` directory exists, offer: "Initialize a git repository?"
   - If yes: `git init`
   - If no: continue without git (warn that commits at the end will be skipped)

### Verification

Confirm the classification with the user: "I've classified this as a {brownfield/greenfield} project. Is that correct?"
- If wrong: switch to the other flow.

## Step 5: Initialize Maestro

Run `maestro init` (CLI) or `maestro_init` (MCP) to create the `.maestro/` directory structure.

### 5a: Bootstrap Beads Workspace

If `.beads/` does not exist and `br` is available: `br init --prefix maestro --json && br doctor --json`. Skip silently if `br` is not installed.

## Steps 6-10: Interview & File Generation

Each step generates one context file saved to `.maestro/memory/` (global memory). For each step, follow this decision tree:

### Auto-generate vs. Interview Decision Tree

```
Is this a brownfield project with scan data?
  |
  +-- YES: Were strong inferences found for this file?
  |     |
  |     +-- YES --> Default to "Autogenerate" option.
  |     |           Present inferred content. Ask: "Does this look right?"
  |     |           If yes: write file via maestro memory-write --global, move on.
  |     |           If no: fall through to interactive interview.
  |     |
  |     +-- NO  --> Default to "Interactive" option.
  |                 No useful inferences. Ask questions directly.
  |
  +-- NO (greenfield or scan denied):
        --> "Interactive" is the only option.
            Do NOT offer "Autogenerate" -- there is nothing to infer from.
```

**Per-step interview details and question flows are in `reference/interviews.md`.**
**File format templates are in `reference/templates.md`.**

| Step | Memory Key | Description | Skip Condition |
|------|------------|-------------|----------------|
| 6 | `product` | Product definition | Never -- always required |
| 7 | `tech-stack` | Technology stack | Never -- always required |
| 8 | `guidelines` | Coding guidelines | Never -- always required |
| 9 | `product-guidelines` | Product guidelines | User may skip (CLI tools, pure libraries) |
| 10 | `workflow` | Workflow config (use `reference/workflow-template.md`) | Never -- always required |

Files are saved using `maestro memory-write --global --key <key>` (CLI) or `maestro_memory_write` (MCP).

### Per-Step Verification Protocol

After writing each file, verify it before moving on:

1. **Display the generated file** to the user in full.
2. **Ask:** "Does this accurately describe your project? Any corrections?"
3. **If corrections needed:** Edit the file, display again, re-ask.
4. **If confirmed:** Move to next step.

**Never skip verification.** An inaccurate context file will poison every downstream skill. Catching errors here costs seconds; catching them during implementation costs hours.

## Step 11: Code Style Guides (Optional)

Offer to copy style guides from `reference/styleguides/` to `.maestro/memory/code_styleguides/`.
See `reference/interviews.md` for the question format.

**Decision logic:**
- If brownfield with detected languages: pre-select matching guides, offer to confirm.
- If greenfield with known tech stack (from Step 7): pre-select matching guides.
- If no languages detected: show full list.

## Step 12: Generate Index File

Write a memory entry `index` via `maestro memory-write --global --key index` linking all context memory entries. See `reference/templates.md`.

**Verification:** Confirm every entry listed in the index actually exists. If an entry is missing (user skipped product-guidelines, etc.), omit it from the index rather than linking to a nonexistent entry.

## Step 13: First Feature (Optional)

Offer to create the first feature using `maestro feature-create` (CLI) or `maestro_feature_create` (MCP). See `reference/interviews.md` for the flow and `reference/templates.md` for file formats.

**When to recommend creating a feature:**
- User mentioned a specific feature or bug during the interview --> recommend yes.
- User is exploring / just setting up --> recommend skip.

## Step 14: Summary and Commit

Display summary of all generated files. See `reference/templates.md` for output format and commit messages.

**Pre-commit verification:**
1. List every file that will be committed.
2. Confirm no secrets, credentials, or sensitive data in any context file.
3. If no `.git/`: skip commit, warn user that files are untracked.

## Step 15: Auto-Generate AGENTS.md

After the commit succeeds, check if `AGENTS.md` exists. If it does NOT exist, automatically invoke `/maestro:AGENTS.md` (no arguments, no user prompt). If `AGENTS.md` already exists, skip silently.

---

## When Stuck

| Problem | Solution |
|---------|----------|
| Can't detect tech stack | Ask the user directly. Don't guess. |
| User gives vague product description | Ask: "What problem does this solve for your users?" Rephrase their answer. |
| Existing CLAUDE.md contradicts user's answers | Show the contradiction. Ask which is correct. Update the context file accordingly. |
| Scan finds multiple languages | List all. Ask which are primary vs. incidental (e.g., shell scripts for CI). |
| User wants to skip all interviews | Use autogenerate for everything. Still verify each file. |
| User disagrees with autogenerated content | Switch to interactive for that step. Don't argue with the user about their own project. |

## Red Flags -- STOP and Ask

- Context file contains placeholder text (`{user's answer}`, `TODO`, `TBD`) --> file was not properly filled in. Go back and fix.
- Tech stack file lists technologies not actually used --> will cause incorrect test/build commands. Verify with `package.json` / manifests.
- Product description is copy-pasted from a different project --> all downstream skills will generate wrong context. Re-interview.
- Guidelines file contradicts CLAUDE.md --> downstream skills will get conflicting instructions. Resolve the conflict explicitly.
- Workflow file has no test command defined --> `maestro:implement` will not know how to run tests. Fill it in.

---

## Relationship to Other Commands

Recommended workflow:

- `maestro init` -- Initialize maestro directory structure
- `maestro:setup` -- **You are here.** Scaffold project context (run after init)
- `maestro:agents-md` -- Generate AGENTS.md context file (offered at end of setup)
- `maestro_feature_create` -- Create a feature to work on
- `maestro:design` -- Deep discovery for ambitious features
- `maestro_plan_write` -- Write the implementation plan
- `maestro_plan_approve` -- Approve the plan for execution
- `maestro_tasks_sync` -- Generate tasks from approved plan
- `maestro:implement` -- Execute the implementation
- `maestro:review` -- Verify implementation correctness
- `maestro_status` -- Check progress across all features

Setup is the entry point for all maestro workflows. All other commands depend on the memory entries it creates. Run this once per project, then use `maestro_feature_create` to start building.
