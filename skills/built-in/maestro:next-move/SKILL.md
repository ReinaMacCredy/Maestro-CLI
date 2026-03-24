---
name: maestro:next-move
description: "Strategic analysis of a project to identify the single highest-leverage, most innovative addition. Use when the user asks what to build next, what the most impactful improvement would be, what's missing, or any question about strategic direction and priorities. Also use when stuck choosing between competing features."
argument-hint: "[vision or focus area (optional)]"
audience: orchestrator
---

# Next Move

Analyze a project deeply to surface the single most impactful addition. Not the obvious thing.
Not "add more tests." The one insight that, once seen, feels inevitable.

## Before You Begin

Check maestro state and gather context in parallel:

1. **`maestro_status`** -- what features exist, pipeline state, active work
2. **`maestro_memory_list`** -- what's already been discovered and decided
3. **`maestro_doctrine_list`** -- what constraints and principles are in play
4. **`maestro_execution_insights`** -- patterns from past execution (blockers, velocity, pain points)
5. **Ask the user one question**: "What are you trying to achieve with this project -- what's the vision?"

If they passed an argument (vision or focus area), use that instead of asking. If they've already
stated their goals in conversation, use what they said.

Read any relevant memories and doctrine entries -- they contain decisions and learnings that
raw code analysis would miss.

## The Analysis

### Phase 1: Map the Territory

Explore the codebase with subagents. You need to understand:

- **Architecture and structure**: How is the code organized? Core abstractions? Boundaries?
- **Domain and purpose**: What problem does this solve? Who is it for?
- **Capabilities**: What can it do today? Strongest features? Where has effort been invested?
- **Trajectory**: Last 20-30 commits. Recent direction. What was just added?
- **Gaps and pain points**: What's conspicuously absent? Where are the TODOs, FIXMEs, workarounds?
- **Ecosystem**: Dependencies, integrations, deployment story.

Spawn 2-3 exploration subagents covering different facets so this phase moves fast.

Cross-reference what you find with maestro state:
- Do existing memories mention known gaps or deferred decisions?
- Does doctrine constrain what kinds of additions are appropriate?
- Do execution insights reveal recurring blockers or velocity patterns?

### Phase 2: Find the Thesis

Every worthwhile project has a core thesis -- the central bet it's making. It may be
explicit (in a README or design doc) or implicit (in the architecture and design choices).

- What is the project's reason for existing?
- What is it opinionated about? Where is it flexible?
- What are the implicit beliefs embedded in the design?

The best addition reinforces and extends the thesis. Additions that dilute it are wrong
no matter how clever they are.

### Phase 3: Strategic Reasoning

Think like a strategist. Look for:

**Leverage points** -- small effort, disproportionate value:
- A capability that would make 3+ existing features more powerful
- A missing abstraction that would simplify multiple areas
- An integration that connects the project to a larger ecosystem
- A primitive that other features could build on

**Feedback loops** -- self-reinforcing cycles:
- Usage data that improves future behavior
- Generated artifacts that become inputs to other processes
- Network effects where each new user/integration multiplies value

**Unlock conditions** -- impossible becomes trivially easy:
- Features users probably want that the architecture can't support yet
- What would make this 10x more useful to existing users?
- What adjacent problem could it solve with a small extension?

**Timing signals** -- why this, right now:
- Recent architectural changes that make something newly feasible
- Momentum in a direction that this would accelerate
- Patterns in execution insights (recurring blockers, repeated decisions)

### Phase 4: Generate and Filter

Generate 3-5 candidate additions. For each: what it is, why it matters, how it compounds,
whether it's feasible.

Then filter ruthlessly:

- **"Of course" test**: Does it feel inevitable? If you have to argue hard, it's not THE move.
- **Compound test**: More valuable in 6 months than today? If not, not accretive enough.
- **Leverage test**: Works WITH the existing architecture? Best moves feel like they belong.
- **Novelty test**: Genuinely innovative, or just "best practice"? Tests, CI/CD, linting -- fine, not moves.
- **Excitement test**: Does it generate energy? Best ideas make you want to build them.

Select one. If two are close, pick the one that unlocks more future possibilities.

### Phase 5: Develop the Recommendation

Present your recommendation:

```
# The Move: [Concise Title]

## The Insight
[What you noticed and why it matters. This should feel like a revelation.]

## The Argument
[Why THIS is THE thing. Reference specific code, compare alternatives, explain why this wins.]

## How It Compounds
[What the project looks like in 3 months. 6 months. What becomes possible.]

## The Sketch
[Key components, interfaces, data flows. How it fits the existing architecture.
Concrete enough to start building tomorrow.]

## Risks and Assumptions
[What could go wrong. What you're assuming.]

## Runner-Up
[Second-best candidate and why it lost.]
```

## Persisting the Analysis

After the user reacts to the recommendation, persist the valuable parts:

```
# Save the strategic analysis
maestro_memory_write({
  key: "strategic-analysis-<date>",
  content: "<the full analysis: thesis, leverage points, candidates, winner>",
  scope: "global"
})

# If the user wants to pursue it, create the feature
maestro_feature_create({
  name: "<feature-name>",
  description: "<one-line from The Move>"
})

# Save the design sketch as discovery context
maestro_memory_write({
  key: "next-move-discovery",
  content: "<The Sketch section + key decisions>",
  feature: "<feature-name>"
})
```

This feeds directly into `maestro:brainstorming` or `maestro:design` for deeper exploration,
or into `maestro_plan_write` if the scope is clear enough.

## Chaining Forward

After the user validates the recommendation:

```
Is the scope clear and small (1-3 tasks)?
  --> maestro_plan_write directly
Is it ambitious or multi-component?
  --> maestro:brainstorming (explore the design space)
  --> maestro:design (full discovery + spec)
Does the user want to think more before committing?
  --> Save as memory, revisit later
```

## What to Avoid

- **The obvious suggestion**: "Add better error handling." Not a strategic insight.
- **The kitchen sink**: Recommending 5 things. ONE forces deeper thinking.
- **The technology crush**: Cool tech that doesn't solve a real problem for THIS project.
- **The abstraction astronaut**: Grand frameworks when a concrete addition would do.
- **Infrastructure theater**: CI/CD, monitoring, docs -- fine work, not strategic moves.
- **Ignoring maestro state**: Memories, doctrine, and execution insights exist for a reason.
  A recommendation that contradicts established doctrine or re-proposes a rejected idea
  (without addressing why it was rejected) shows shallow analysis.
