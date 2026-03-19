---
name: maestro:note
description: "Capture decisions, constraints, and context to persistent memory. Global memory is injected into every session and implementation run. Per-feature memory tracks working context."
argument-hint: "<content> [--global|--show|--prune|--clear <scope>]"
---

# Note -- Persistent Working Memory

Notes are the cross-cutting memory layer. They persist across sessions, survive context resets, and -- for global memory -- are automatically injected into every worker prompt.

**Core principle:** If a future session needs this to avoid a mistake, capture it. If not, skip it.

## Mental Model

Two-tier system mapped to the v2 memory architecture:

- **Global Memory** = pinned message in a channel. Every agent sees it, every time. Hard constraints that, if violated, produce wrong code. Workers cannot ask clarifying questions -- they need these upfront. Stored via `maestro memory-write --global` / `maestro_memory_write`.
- **Feature Memory** = searchable thread history scoped to the active feature. Insights, learnings, and soft observations accumulated during implementation. Available on demand, pruned periodically. Stored via `maestro memory-write` / `maestro_memory_write` (defaults to active feature).
- **Promoted Memory** = feature-scoped insights promoted to global after proving valuable. Use `maestro memory-promote` / `maestro_memory_promote` to elevate.

## When to Capture

**Always:**
- Decisions that constrain future work (API choice, library version, architecture direction)
- Constraints discovered mid-implementation (rate limits, API quirks, platform bugs)
- User decisions on blockers (the "why" behind the choice, so no one re-asks)
- Cross-feature dependencies ("feature X depends on auth refactor from feature Y")

**Never:**
- Status updates ("started task 3") -- use `maestro_task_done` / `maestro_task_block`
- Things already in spec or plan -- don't duplicate
- Temporary debugging notes ("tried X, didn't work") -- ephemeral, discard

**Decision heuristic:** "Will a future session need this to avoid a mistake?" Yes = capture. No = skip.

## Global Memory vs Feature Memory

| Attribute | Global Memory | Feature Memory |
|-----------|--------------|----------------|
| Injection | Every session + every worker prompt | On-demand via `maestro memory-read` |
| Audience | All agents, including workers who cannot ask | Orchestrator and feature workers |
| Content | Hard constraints, blocking decisions | Insights, learnings, soft preferences |
| Lifespan | Until constraint lifts | Until feature completes or pruned |
| Volume | **3-7 entries max** (more = noise) | Unlimited (prune periodically) |
| Format | Imperative constraint | Dated insight with feature context |
| Storage | `.maestro/memory/` | `.maestro/features/<feature-name>/memory/` |

**Promoting to Global:** If a feature memory note keeps causing mistakes across sessions, promote it with `maestro memory-promote` / `maestro_memory_promote`. If a global note no longer applies, delete it with `maestro memory-delete`.

## Good Notes vs Bad Notes

<Good>
```
maestro memory-write --global --key api-envelope "All new endpoints MUST use v2 response envelope ({ data, meta, errors })"
```
Specific, actionable, a worker can follow this without asking.
</Good>

<Bad>
```
maestro memory-write --global --key api-conventions "Remember to follow the API conventions"
```
Which conventions? This tells a worker nothing. They will guess wrong.
</Bad>

<Good>
```
maestro memory-write --key stripe-rate-limit "[2026-03-15] [payments:task-1] Stripe rate limit is 100/sec in test mode; batch ops must throttle with 10ms delay"
```
Dated, attributed, quantified, includes the mitigation.
</Good>

<Bad>
```
maestro memory-write --key stripe "Stripe has rate limits"
```
Every API has rate limits. No date, no feature, no number, no action.
</Bad>

See `reference/note-patterns.md` for more examples across decisions, constraints, discoveries, and dependencies.

## Arguments

`$ARGUMENTS`

| Input | Action |
|-------|--------|
| `<content>` (no flag) | Write to active feature memory |
| `--global <content>` | Write to global memory |
| `--show` | Display all memory (`maestro memory-list`) |
| `--prune` | Remove stale feature memory entries |
| `--clear <scope>` | Clear memory (`global`, `feature`, `all`) |

## Execution

### Step 1: Ensure Memory System Ready

Check that maestro is initialized (`maestro_status` or `maestro status`). If `.maestro/` does not exist: "Run `maestro init` first."

### Step 2: Parse and Execute

**Add** (default or `--global`):
1. Determine scope: `--global` writes to `.maestro/memory/`, default writes to active feature memory
2. Generate a key from the content (kebab-case, descriptive, 2-4 words)
3. Call `maestro memory-write --key <key> "<content>"` (add `--global` for global scope)
4. Display confirmation with the key and scope

**Show** (`--show`):
1. Call `maestro memory-list` to show all memory entries
2. If no entries: "No memory entries found. Use `maestro:note <content>` to start."

**Prune** (`--prune`):
1. Call `maestro memory-list` for the active feature
2. Review each entry for staleness
3. Remove stale entries with `maestro memory-delete --key <key>`
4. Keep global memory intact
5. Show what was removed and what was kept
6. If uncertain about an item, ask the user

**Clear** (`--clear <scope>`):
1. Parse scope: `global`, `feature`, or `all`
2. If clearing global: confirm with user first
3. Delete all entries in the specified scope
4. Confirm deletion

## Note Lifecycle

```
Create --> Review (session start) --> Update (constraint changes) --> Promote/Archive/Delete (resolved)
```

| Trigger | Action |
|---------|--------|
| New decision or constraint discovered | Write memory (choose scope) |
| Session start | Review global memory -- still accurate? |
| Constraint changed | Update the memory entry (overwrite with same key) |
| Feature shipped | Prune feature memory, promote valuable insights to global |
| Constraint lifted | Delete the global memory entry |
| Insight proved valuable across features | `maestro memory-promote` to elevate to global |

## Anti-Patterns

| Anti-Pattern | Why It Hurts | Fix |
|-------------|-------------|-----|
| Notes too vague ("the API thing") | Future sessions cannot act on it | Include specifics: which API, what behavior, what constraint |
| Notes too long (full paragraphs) | Agents skim or skip long entries | One line per note. Details go in a separate memory entry |
| Duplicating spec/plan content | Two sources of truth that drift apart | Reference the spec; don't copy it |
| Global memory bloat (>7 items) | Agents stop reading; noise drowns signal | Prune aggressively. Only hard constraints belong in global |
| Never pruning feature memory | Graveyard of stale insights misleads agents | Prune after each feature completion |
| Status updates as notes | Notes are for decisions and constraints, not progress | Use `maestro_task_done` / `maestro_task_block` for status |

## Section Contracts

| Scope | Written By | Read By | Persistence |
|-------|-----------|---------|-------------|
| Global memory | User via `--global`, `maestro_memory_promote` | `maestro:implement` workers, all sessions | Until manually deleted |
| Feature memory | Default `maestro:note`, auto-capture during implementation | Orchestrator and feature workers | Until feature completes or pruned |

## Relationship to Other Commands

- `maestro init` -- Initialize maestro for the project
- `maestro_feature_create` -- Create a feature to work on
- `maestro skill maestro:new-feature` -- Create feature with spec and plan
- `maestro skill maestro:implement` -- Execute implementation (reads global memory at start)
- `maestro skill maestro:review` -- Verify implementation correctness
- `maestro_status` -- Check progress across all features
- `maestro skill maestro:note` -- **You are here.** Capture decisions and context to persistent memory

Global memory is automatically loaded by `maestro:implement` at execution start and injected into worker prompts. Feature memory accumulates insights from both manual notes and auto-capture during implementation. Use `--prune` after each feature completion to keep memory relevant. Use `maestro_memory_promote` to elevate high-value feature insights to global scope.
