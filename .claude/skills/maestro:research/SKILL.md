---
name: maestro:research
description: "Structured research workflow for maestro features. Guides tool selection across three tiers (codebase exploration, Context7 for library docs, NotebookLM for deep analysis), defines research patterns, finding organization via memory_write, and completion criteria. Use during the research pipeline stage after feature_create and before plan_write. Also use when investigating a problem space, comparing technical approaches, gathering context on unfamiliar code, or needing to understand external library APIs before making architectural decisions."
---

# Research Phase

Research sits between discovery and planning. Its job: gather enough understanding to write a plan you're confident in. A plan without research is guessing; research without a plan is wandering.

## Research Mindset

Before diving in, question the question itself. Initial framing is often wrong -- the real problem may be different from what was first described. Research is exploratory: the goal is to gain surface area, identify unknown unknowns, and develop crisper ways of thinking about the problem.

**Start small.** Run the smallest investigation that could answer the question. If a 5-minute subagent search reveals the answer, don't spend an hour on multi-source synthesis. Scale up only when the small version shows signs that deeper investigation is needed.

**Critique assumptions.** Before executing a research plan, push back on it. Is there a simpler approach? Are we making incorrect assumptions about how the system works? A good researcher challenges the premise, not just answers the question.

**Tight feedback loops.** Prefer quick, focused investigations over marathon research sessions. Three 10-minute sprints with synthesis between them beat one 30-minute unfocused exploration. Each sprint should produce a concrete finding saved to memory.

## When to Research

Enter research when:
- A feature exists (`feature_create` done)
- The problem involves unfamiliar code, external libraries, or multiple valid approaches
- You can't yet write a confident `## Discovery` section for the plan

Skip research when the task is mechanical (rename, config change, straightforward addition) or you already have deep context from prior work.

## Research Tiers

Maestro detects available tools at session start via `.mcp.json`. Your approach adapts to what's installed.

### Tier 1: Always Available

**Codebase exploration** -- Agent subagents

Use for understanding existing code, finding patterns, tracing data flow. Spawn focused subagents with one clear objective each. Save findings with `memory_write`.

```
memory_write({
  feature: "my-feature",
  name: "research-existing-auth-patterns",
  content: "## Motivation\nUnderstand current auth to avoid divergent patterns.\n\n## Findings\nMiddleware-based auth in src/middleware/auth.ts...\nRelevant files: auth.ts:45, router.ts:12\n\n## Implications\nNew auth flow should follow the same middleware pattern.\n\n## Limitations\nOnly traced the HTTP path; WebSocket auth may differ."
})
```

**Web search** -- WebSearch + WebFetch

Use for error messages, ecosystem comparisons, best practices. Always save fetched content to a local file or memory immediately -- interrupted sessions lose unsaved fetches.

### Tier 2: Context7

**Detected when**: `context7` MCP server present in `.mcp.json`

Context7 provides current library documentation, not stale training data. This matters when:
- Checking API signatures for a specific library version
- Finding migration guides between versions
- Understanding framework patterns that change across releases
- Verifying that an approach you're considering is still the recommended one

```
# Example: researching a Zod schema pattern
context7_search({ library: "zod", query: "discriminated union validation" })
```

**When NOT available**: Fall back to WebSearch for library docs. Note in your findings that docs may be outdated relative to the version you're targeting.

### Tier 3: NotebookLM

**Detected when**: `notebooklm` MCP server present in `.mcp.json`

NotebookLM excels at multi-source synthesis -- feeding it several documents and asking analytical questions. Use it for:
- Comparing architectural approaches with trade-off analysis
- Synthesizing information from multiple docs/specs/codebases
- Generating structured analysis from unstructured sources
- Deep-diving into a domain you're unfamiliar with

**When NOT available**: Do comparative analysis manually. Use parallel subagents to research each approach, then synthesize in main context.

## Research Patterns

### Pattern 1: Breadth-First Exploration

**When**: You don't know what you don't know.

1. Spawn 2-3 parallel subagents, each exploring a different angle
2. Synthesize findings -- identify knowledge gaps and unknown unknowns
3. Targeted follow-up on gaps (scale up only if small probes show complexity)
4. Save consolidated understanding via `memory_write`

Good for: greenfield features, unfamiliar domains, "how does this system work?"

### Pattern 2: Depth-First Investigation

**When**: You know the area but need deep understanding.

1. Start at the entry point (function, module, API)
2. Trace the full path (data flow, call chain, state transitions)
3. Document assumptions and edge cases found along the way
4. Save detailed analysis via `memory_write`

Good for: bug investigation, performance analysis, "what happens when X?"

### Pattern 3: Comparative Analysis

**When**: Multiple valid approaches exist and you need to choose.

1. Define evaluation criteria (performance, complexity, maintainability, risk)
2. Research each approach -- parallel subagents for codebase, Context7 for library APIs, NotebookLM for synthesis
3. Build a comparison matrix
4. Recommend with reasoning -- but also note reservations and confounders
5. Save comparison and recommendation via `memory_write`

Good for: library selection, architecture decisions, "should we use A or B?"

### Pattern 4: Constraint Discovery

**When**: You need to understand what limits the solution.

1. Check existing code for assumptions and invariants
2. Check external dependencies for version constraints or API limits
3. Check project config (CLAUDE.md, AGENTS.md, package.json)
4. Separate hard constraints from soft preferences
5. Save constraints via `memory_write`

Good for: migrations, refactors, "what can't we change?"

## Organizing Findings

Every significant finding gets saved with `memory_write` scoped to the current feature. Structure each finding as a mini write-up:

```
## Motivation
What question were we trying to answer? (1-2 lines, precise, no vague language)

## Findings
What did we learn? (methods, evidence, relevant files/sources)

## Implications
How does this affect the plan? (design decisions, constraints, recommendations)

## Limitations
What caveats apply? (confounders, incomplete coverage, assumptions made)

## Next Steps
What follow-up research would strengthen this finding? (optional -- only if gaps remain)
```

Use descriptive names:

| Finding type | Name pattern | Example |
|---|---|---|
| Codebase understanding | `research-<area>` | `research-existing-auth-patterns` |
| Library/API investigation | `research-<lib>-api` | `research-zod-discriminated-unions` |
| Comparative analysis | `research-<topic>-comparison` | `research-ws-vs-sse-comparison` |
| Constraints/risks | `research-constraints` | `research-api-rate-limits` |
| External reference | `research-<source>-notes` | `research-react-router-v6-migration` |

## Completion Criteria

Research is done when you can answer YES to all five:

1. **Problem understood** -- Can you explain the problem in one paragraph without hand-waving?
2. **Solution space mapped** -- Do you know the viable approaches and their trade-offs?
3. **Constraints identified** -- Do you know what limits the solution (technical, time, dependencies)?
4. **Key decisions ready** -- Are the major architectural decisions ready to be made?
5. **No known unknowns** -- Is there anything you're aware you don't understand?

If any answer is NO, target the specific gap. But also be honest about limitations: if a question can't be answered without building the thing, note it as a limitation and move on. Research that never ends is as bad as no research at all.

## Transitioning to Planning

When research is complete:

1. Run `memory_list` to review all saved findings
2. Identify the 2-3 findings that most shape the plan
3. Write the plan with `plan_write` -- the `## Discovery` section should reference your research findings by name
4. The pipeline automatically advances from 'research' to 'planning'

The plan's `## Discovery` section is where research pays off. It should read as a confident summary of what you learned -- motivation, key findings, implications, and acknowledged limitations. Not a log of what you did.

## Tool Selection Quick Reference

| Question | Subagents | Context7 | NotebookLM |
|---|---|---|---|
| How does our code handle X? | [-->] primary | -- | -- |
| What's the API for library Y? | WebSearch fallback | [-->] primary | -- |
| Should we use approach A or B? | Research each | Docs for each | [-->] synthesize |
| What are the constraints? | Code + config | Dep docs | -- |
| What's the ecosystem best practice? | WebSearch | [-->] current docs | Deep analysis |
| Synthesize 5+ sources into analysis | Manual | -- | [-->] primary |
| Is this still the recommended pattern? | -- | [-->] primary | -- |

`[-->]` = best tool for the job. Use the highest available tier. Fall back gracefully when tools aren't installed.
