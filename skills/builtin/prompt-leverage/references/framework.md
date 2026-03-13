# Prompt Leverage Framework

A practical execution framework for upgrading prompts. Combines behavioral controls (intensity, breadth, depth, first-principles thinking) with execution controls (clear objectives, output contracts, tool persistence, verification loops, completion criteria).

The overall structure:

`Role -> Objective -> Context -> Work Style -> Tool Rules -> Output Contract -> Verification -> Done`

## Block Definitions

### Role

Set a persona when it focuses behavior and tone. Even a single sentence makes a difference. Match the role to the task domain -- a "senior security auditor" produces different output than a "helpful assistant" on the same code review prompt.

### Objective

State the task in one or two lines. Define success in observable terms. Avoid vague quality adjectives; prefer concrete completion criteria.

### Context

Specify relevant files, URLs, constraints, assumptions, and information boundaries. Say when the agent must retrieve facts instead of guessing. Include:

- What the agent already has access to (files, repos, APIs).
- What it needs to look up or ask about.
- What it should NOT assume.

### Work Style

Control how the agent approaches the task.

- Go broad first when system understanding matters.
- Go deep where risk or complexity is highest.
- Use first-principles reasoning before changing things.
- Re-check with fresh eyes for non-trivial tasks.
- Prefer general instructions ("think thoroughly") over prescriptive step-by-step plans -- the model's reasoning frequently exceeds what a human would prescribe.

### Tool Rules

Define when browsing, file inspection, tests, or external tools are required. Prevent skipping prerequisite checks. Ensure tool use is persistent (don't stop early) and dependency-aware (resolve prerequisites before acting).

See provider-specific files for concrete XML block patterns (e.g., `<tool_persistence_rules>`, `<dependency_checks>`).

### Output Contract

Define exact structure, tone, formatting, depth, and any required sections or schemas. Be explicit about what format to emit and what to omit. Balance conciseness with completeness -- do not shorten so aggressively that required evidence is lost.

See provider-specific files for concrete XML block patterns (e.g., `<output_contract>`, `<verbosity_controls>`).

### Verification

Require checks for correctness, grounding, completeness, side effects, and better alternatives.

- After completing the main task, re-read the result against the original request.
- Check for factual grounding -- are claims supported by evidence?
- Check for completeness -- are all parts of the request addressed?
- Check for side effects -- could this change break something else?
- Ask: is there a simpler or more elegant approach?

### Done Criteria

Define what must be true before the agent stops. Explicit completion criteria prevent the model from stopping at the first plausible answer or continuing indefinitely.

## Intensity Levels

Use the minimum level that matches the task.

- `Light`: simple edits, formatting, quick rewrites. Minimal scaffolding needed.
- `Standard`: typical coding, research, and drafting tasks. Add objective, output contract, and basic verification.
- `Deep`: debugging, architecture, complex research, or high-stakes outputs. Full framework with tool rules, verification loop, and explicit done criteria.

## Task-Type Adjustments

### Coding

- Emphasize repo context, file inspection, smallest correct change, validation, and edge cases.
- Add dependency checks: "Read the relevant files before modifying them."
- Include test expectations: "Verify the change with the narrowest useful checks."

### Research

- Emphasize source quality, evidence gathering, synthesis, uncertainty, and citations.
- Add retrieval rules: "Retrieve evidence from reliable sources before concluding."
- Include confidence markers: "Flag uncertainty rather than guessing."

### Writing

- Emphasize audience, tone, structure, constraints, and revision criteria.
- Specify the format and voice explicitly.
- Include self-edit pass: "Review for clarity, flow, and consistency before finalizing."

### Analysis

- Emphasize decomposition, evidence, assumptions, and alternative explanations.
- Add structure: "Break the problem into components before synthesizing."

### Planning

- Emphasize scope, constraints, dependencies, risks, and actionable next steps.
- Include prioritization: "Order by impact and feasibility."

### Review

- Emphasize fresh-eyes critique, failure modes, alternatives, and explicit severity.
- Add grounding: "Read enough surrounding context to understand intent before critiquing."
- Distinguish confirmed issues from plausible risks.

## Prompt Upgrade Heuristics

- Add missing blocks only when they materially improve execution.
- Do not turn a one-line request into a giant spec unless the task is genuinely complex.
- Preserve user language where possible so the upgraded prompt still feels native.
- Prefer concrete completion criteria over vague quality adjectives.
- Use XML tags (`<instructions>`, `<context>`, `<output_format>`) to separate concerns in complex prompts.
- Include 3-5 diverse few-shot examples when steering output format or tone.
- Tell the model what to do, not what not to do.

## Upgrade Rubric

An upgraded prompt is good when it:

1. Preserves original intent.
2. Reduces ambiguity.
3. Sets the right depth and care level.
4. Defines the expected output clearly.
5. Includes an appropriate verification step.
6. Tells the agent when to stop.
7. Follows provider-specific best practices where applicable.
