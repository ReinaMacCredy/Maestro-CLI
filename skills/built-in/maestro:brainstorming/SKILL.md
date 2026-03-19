---
name: maestro:brainstorming
description: "Use before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then run the structured interview in `reference/interview-guide.md` to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

## The Process

### Phase 1: Understanding the Idea

- Check out the current project state first (files, docs, recent commits)
- Read `reference/interview-guide.md` and follow its question sequence
- Skip questions the user already answered in their initial request
- Offer multiple-choice options where the guide provides them
- Only one question per message (two max if closely related)
- Summarize your understanding before moving to approaches

### Phase 2: Exploring Approaches

- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why
- For each approach, cover: complexity, risk, time estimate, extensibility
- Let the user pick or combine approaches before proceeding

### Phase 3: Presenting the Design

- Once you believe you understand what you're building, present the design
- Break it into sections of 200-300 words
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

### Phase 4: Validating and Recording

- Once design is validated, persist discoveries before they are lost
- Save findings to maestro memory so the planner can reference them
- Chain into the appropriate next step (see "Chaining Into Maestro" below)

## Persisting Discoveries

Brainstorming insights are valuable but volatile -- they exist only in the conversation context. Persist them before moving on.

**What to persist:**
- The validated design summary (architecture, components, data flow)
- Key decisions made during brainstorming and their reasoning
- Rejected approaches and why they were rejected (prevents re-exploration)
- Constraints and edge cases surfaced during discussion
- Non-goals and explicit scope boundaries

**How to persist:**
```
# Create the feature first (if it doesn't exist yet)
maestro_feature_create({ name: "<feature-name>", description: "<one-line>" })

# Save the brainstorming output as feature memory
maestro_memory_write({
  key: "brainstorm-summary",
  content: "<validated design summary>",
  feature: "<feature-name>"
})

# Save key decisions separately for easy reference
maestro_memory_write({
  key: "design-decisions",
  content: "<decisions and rationale>",
  feature: "<feature-name>"
})
```

**When to persist:** After the user validates the design in Phase 3, before chaining into planning. Do not wait until the end of the conversation -- persist as soon as the design stabilizes.

## Chaining Into Maestro

Brainstorming produces understanding, not documents. The validated design feeds directly into the maestro workflow -- never into standalone files under `docs/`.

**When the design is validated, chain forward:**

1. **Create the feature** (if not already done): `maestro_feature_create` -- registers the feature in the maestro tracker
2. **Save discovery context**: `maestro_memory_write` with the brainstorming output -- persists where the planner can reference it
3. **Choose the planning path** based on complexity:
   - **Simple/well-understood**: `maestro_plan_write` -- write the plan directly from the brainstorming output
   - **Ambitious/multi-component**: Load `maestro:design` or `maestro:new-feature` for deeper discovery and structured spec generation

The brainstorming output becomes the `## Discovery` section that `maestro_plan_write` requires. Do not write design docs to `docs/plans/` -- that bypasses the maestro workflow and leaves the design disconnected from execution.

### Decision Tree: What Comes Next?

```
Is the scope clear and small (1-3 tasks)?
  --> YES: maestro_plan_write directly
  --> NO:
    Is a formal spec needed (multiple stakeholders, complex requirements)?
      --> YES: maestro:design (full 16-step process)
      --> NO: maestro:new-feature (interview + spec + plan)
```

## Good vs Bad Brainstorming

### Good Output

A good brainstorming session produces:
- Clear problem statement with "why" articulated
- 2-3 approaches evaluated with trade-offs
- One recommended approach with reasoning
- Explicit scope boundaries (what's in, what's out)
- Key edge cases and error scenarios identified
- Technical constraints surfaced and addressed

**Example summary:**
```
## Design: Rate Limiting for REST API

**Problem**: No rate limiting means a single abusive client can degrade
service for all users. We had an incident on 2026-03-01 where one client
sent 10K req/sec and caused 503s for everyone.

**Approach**: Sliding window counter with Redis backend.
- Rejected token bucket (harder to implement distributed).
- Rejected fixed window (allows burst at window boundary).

**Scope**: Per-user limits on authenticated endpoints only.
**Non-goals**: IP-based limiting, per-endpoint limits, admin dashboard.

**Key decisions**:
- Fail open (allow request) if Redis is unavailable
- Return Retry-After header with 429 responses
- Default 100 req/min, configurable per user tier
```

### Bad Output

- "We should add rate limiting" -- no approaches, no scope, no decisions
- 2000-word essay with no structure -- not scannable by a planner
- Design that includes implementation details ("use the redis SET NX command") -- that's planning, not designing
- No non-goals defined -- scope will creep during implementation

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **Skip what's known** - If the user gave details upfront, acknowledge them and move on
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
- **Challenge assumptions** - Surface fragile assumptions, ask what changes if they fail, offer lean fallback options
- **Persist before chaining** - Save brainstorming output to memory before moving to planning
- **Stay in the "what" lane** - Brainstorming defines what to build and why. Implementation details (specific libraries, exact file paths, code patterns) belong in the plan, not the brainstorm.

## Relationship to Other Commands

- `maestro_feature_create` -- Create a feature to work on (do this during brainstorming)
- `maestro_memory_write` -- Persist brainstorming discoveries
- `maestro:brainstorming` -- **You are here.** Explore ideas before planning
- `maestro:design` -- Deep discovery for ambitious features (next step for complex work)
- `maestro:new-feature` -- Interview + spec + plan (next step for medium complexity)
- `maestro_plan_write` -- Write the plan directly (next step for simple work)
- `maestro_plan_approve` -- Approve the plan for execution
- `maestro:implement` -- Execute the implementation
