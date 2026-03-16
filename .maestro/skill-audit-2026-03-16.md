# Claude Code Skill Audit -- maestroCLI

**Date:** 2026-03-16
**Project:** maestroCLI (Agent-Optimized Development Orchestrator)
**Stack:** TypeScript + bun, hexagonal architecture (ports/adapters), MCP server

---

## 1. Existing Skills

### Claude Code Project Skills (`.claude/skills/`)

| Skill | Purpose | Has References |
|-------|---------|----------------|
| `mcp-builder` | Generic MCP server building guidance | Yes (Python, Node, best practices, evaluation) |
| `prompt-leverage` | Prompt strengthening for AI agents | Yes (Anthropic, OpenAI, framework) |
| `maestro:brainstorming` | Pre-implementation design exploration | Yes (interview guide) |
| `maestro:plan-review-loop` | Iterative plan review with subagents | Yes (review dimensions) |

### Built-in Maestro Skills (`skills/built-in/` -- 19 total)

| Skill | Purpose | Status |
|-------|---------|--------|
| `maestro:agents-md` | AGENTS.md authoring | Active |
| `maestro:brainstorming` | Design exploration | Active, duplicated in .claude/skills/ |
| `maestro:debugging` | Systematic debugging | Active |
| `maestro:design` | Deep BMAD-style specification | Active |
| `maestro:dispatching` | Parallel agent dispatch | Active |
| `maestro:docker` | Docker workflow guidance | Active |
| `maestro:implement` | Task execution (TDD/team/parallel) | Active |
| `maestro:new-track` | Track creation with spec+plan | Active |
| `maestro:note` | Persistent working memory | Active |
| `maestro:parallel-exploration` | Scout fan-out research | Active |
| `maestro:plan-review-loop` | Iterative plan review | Active, duplicated in .claude/skills/ |
| `maestro:prompt-leverage` | Prompt strengthening | Active, duplicated in .claude/skills/ |
| `maestro:revert` | Git-aware undo | Active |
| `maestro:review` | Code review against spec | Active |
| `maestro:setup` | Project context scaffolding | Active |
| `maestro:status` | Feature progress diagnostics | Active |
| `maestro:symphony-setup` | Symphony orchestration | DEPRECATED |
| `maestro:tdd` | Test-driven development | Active |
| `maestro:verification` | Evidence-before-claims | Active |

### External Skills (`skills/external/`)

Empty -- no external skills installed.

---

## 2. Suggested Updates

### 2a. Remove `maestro:symphony-setup`

The skill itself says `> [!] DEPRECATED`. The `maestro symphony install` command replaced it (commits `11a8b89` through `dd0a8c2`). Keeping a deprecated skill in the registry adds noise to `skill-list` output and confuses agents.

**Action:** Delete `skills/built-in/maestro:symphony-setup/` and remove from any generated registry.

### 2b. Reconcile `.claude/skills/` duplicates with `skills/built-in/`

Three skills exist in both locations: `maestro:brainstorming`, `maestro:plan-review-loop`, `prompt-leverage`. The `.claude/skills/` versions are Claude Code skill registrations that wrap the built-in maestro content. These will drift as built-in skills evolve (the built-in versions were recently leveled up in commit `b1ff00e`).

**Action:** Either:
- (A) Make `.claude/skills/` versions thin redirects that load from built-in at runtime, or
- (B) Remove `.claude/skills/` duplicates and rely on the maestro MCP `skill` tool for delivery

### 2c. Specialize `mcp-builder` for maestro's own patterns

The current `mcp-builder` skill is generic (Python FastMCP, Node MCP SDK). maestroCLI IS an MCP server with a specific pattern: port interface --> adapter --> use-case --> server tool registration. The generic skill doesn't encode this.

**Action:** Add a `reference/maestro-mcp-pattern.md` file to `mcp-builder` that documents maestro's own hexagonal MCP tool pattern: where to define the port, where to implement the adapter, where to wire the use-case, and how to register in the server.

### 2d. Expand project memory

Only 2 memory entries for a project with 20+ commits of active development. Missing:
- v2 architecture decisions (4-state task model, plain file backend, memory rename)
- Shared code constraints beyond the one already captured
- User's development workflow preferences for this specific project

**Action:** Save key architectural decisions as project memories after this audit.

---

## 3. Suggested New Skills

### 3a. `maestro-dev` -- maestroCLI Development Workflow

**Why it should exist:** maestroCLI's hexagonal architecture has a specific pattern for every change: port interface, adapter implementation, use-case logic, CLI command wiring, MCP server tool registration, and test coverage. This pattern repeats across every feature (memory system, task states, research phase -- all follow it). Without encoding it, every session rediscovers the wiring sequence.

**Trigger:** When implementing new maestro features, adding commands, or extending the MCP server.

**Core workflow:**
1. Define/extend port interface in `src/ports/`
2. Implement adapter in `src/adapters/` (fs/ for filesystem, br for beads_rust)
3. Wire use-case in `src/usecases/`
4. Add CLI command in `src/commands/<noun>/<verb>.ts`
5. Register MCP tool in `src/server/`
6. Add tests in `src/__tests__/`
7. Rebuild: `bun run build`
8. Verify: `bun test`

**Evidence:** Commits `0106a04`, `2df3383`, `8c6413f`, `0d50076`, `3d2367e`, `114148c` all follow this exact pattern.

### 3b. `maestro-skill-author` -- Creating Built-in Skills

**Why it should exist:** The skills full port track (`skills_full_port_20260315`) shows this is a recurring, error-prone workflow. Skills need: valid frontmatter (name, description, argument-hint), SKILL.md body, optional `reference/` directory with sub-files, build-time embedding, and registry consistency. Multiple commits addressed skills system issues (frontmatter, naming, aliases, caching, references).

**Trigger:** When creating or modifying built-in maestro skills.

**Core workflow:**
1. Create `skills/built-in/<maestro:name>/SKILL.md` with valid frontmatter
2. Add `reference/` files if needed (steps, templates, guides)
3. Ensure colon-prefixed naming convention
4. Rebuild to embed references
5. Verify with `maestro skill-list` and `maestro skill <name>`
6. Check for alias conflicts

**Evidence:** Commits `b1ff00e`, `2e1200d`, `a919788`, `2a23c26`, and the active `skills_full_port_20260315` track.

### 3c. `maestro-v2-migration` -- v2 Architecture Guide

**Why it should exist:** The project is mid-migration to v2 patterns (context --> memory rename, execution layer stripped, 4-state task model adopted). Sessions touching v2 code need to know: what was renamed, what was removed, what the new state model looks like, and which patterns are deprecated.

**Trigger:** When working on v2 features or encountering legacy patterns.

**Core content:**
- Context renamed to memory everywhere (commit `0d50076`)
- Execution layer stripped, 4-state task model (open/claimed/done/blocked) adopted (commit `ccc538b`)
- Plain file task backend is now default (commit `114148c`)
- Pre-agent hook for task spec injection (commit `8c6413f`)
- Research phase with external tool detection (commit `2df3383`)
- memory_promote on feature_complete (commit `0106a04`)

**Evidence:** 7 sequential v2 commits show a coherent migration pattern.

---

## 4. Priority Order

| Rank | Recommendation | Type | Expected Value |
|------|---------------|------|----------------|
| 1 | `maestro-dev` | New skill | High -- every feature follows this pattern; prevents rediscovery every session |
| 2 | Reconcile `.claude/skills/` duplicates | Update | Medium -- prevents drift between two copies of the same skill content |
| 3 | `maestro-skill-author` | New skill | Medium -- active skills port track + recurring skill maintenance |
| 4 | Specialize `mcp-builder` | Update | Medium -- project IS an MCP server; generic guidance misses project patterns |
| 5 | Remove deprecated `symphony-setup` | Update | Low -- cleanup, reduces noise |
| 6 | `maestro-v2-migration` | New skill | Low-Medium -- useful during active migration, short shelf life |
| 7 | Expand project memory | Update | Low -- incremental, can be done as decisions arise |

---

## 5. What NOT to Create

- **Testing skill**: `maestro:tdd` and `maestro:verification` already cover this thoroughly
- **Git workflow skill**: `maestro:revert` handles the hard case; standard git is in CLAUDE.md
- **Code review skill**: `maestro:review` and `maestro:plan-review-loop` are comprehensive
- **Debugging skill**: `maestro:debugging` is already detailed and systematic
- **Planning skill**: `maestro:design` + `maestro:new-track` cover both deep and lightweight planning
