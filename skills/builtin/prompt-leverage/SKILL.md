---
name: prompt-leverage
description: Strengthen a raw user prompt into an execution-ready instruction set for Claude Code, Codex, or another AI agent. Use when the user wants to improve an existing prompt, build a reusable prompting framework, wrap the current request with better structure, add clearer tool rules, or create a hook that upgrades prompts before execution. Also use when the user says "make this prompt better", "optimize my prompt", "prompt engineering", or asks how to get better results from an AI model.
---

# Prompt Leverage

Turn the user's current prompt into a stronger working prompt without changing the underlying intent. Preserve the task, fill in missing execution structure, and add only enough scaffolding to improve reliability.

## Workflow

1. Read the raw prompt and identify the real job to be done.
2. Infer the task type: coding, research, writing, analysis, planning, or review.
3. Rebuild the prompt using the framework blocks in `references/framework.md`.
4. Consult provider-specific guidance when targeting a specific model family:
   - Claude: `references/anthropic-guidance.md`
   - GPT: `references/openai-guidance.md`
   - Cross-provider or unknown target: `references/provider-guidance.md`
5. Keep the result proportional: do not over-specify a simple task.
6. Return both the improved prompt and a short explanation of what changed when useful.

## Transformation Rules

- Preserve the user's objective, constraints, and tone unless they conflict.
- Prefer adding missing structure over rewriting everything stylistically.
- Add context requirements only when they improve correctness.
- Add tool rules only when tool use materially affects correctness.
- Add verification and completion criteria for non-trivial tasks.
- Keep prompts compact enough to be practical in repeated use.
- Use XML tags to separate structural blocks when the prompt mixes instructions, context, examples, and inputs.
- Include few-shot examples when steering output format, tone, or structure -- 3-5 diverse examples wrapped in `<example>` tags is the sweet spot.

## Framework Blocks

Use these blocks selectively. See `references/framework.md` for full definitions and per-task adjustments.

- `Objective`: state the task and what success looks like.
- `Context`: list sources, files, constraints, and unknowns.
- `Role`: set the persona, expertise, and tone when it focuses behavior.
- `Work Style`: set depth, breadth, care, and first-principles expectations.
- `Tool Rules`: state when tools, browsing, or file inspection are required. Include dependency checks and persistence rules.
- `Output Contract`: define structure, formatting, and level of detail. Be explicit about what format to use and what to omit.
- `Verification`: require checks for correctness, edge cases, grounding, and better alternatives.
- `Done Criteria`: define what must be true before the agent stops.

## Output Modes

Choose one mode based on the user request.

- `Inline upgrade`: provide the upgraded prompt only.
- `Upgrade + rationale`: provide the prompt plus a brief list of improvements.
- `Template extraction`: convert the prompt into a reusable fill-in-the-blank template.
- `Hook spec`: explain how to apply the framework automatically before execution.

## Hook Pattern

When the user asks for a hook, model it as a pre-processing layer:

1. Accept the current prompt.
2. Classify the task and risk level.
3. Expand the prompt using the framework blocks.
4. Return the upgraded prompt for execution.
5. Optionally keep a diff or summary of injected structure.

Use `scripts/augment_prompt.py` when a deterministic first-pass rewrite is helpful.

## Quality Bar

Before finalizing, check the upgraded prompt against these criteria:

- Still matches the original intent.
- Does not add unnecessary ceremony.
- Uses XML tags to separate concerns when the prompt is complex.
- Includes the right verification level for the task.
- Gives the agent a clear definition of done.
- Follows provider-specific best practices from the relevant guidance file (`references/anthropic-guidance.md`, `references/openai-guidance.md`, or `references/provider-guidance.md` for cross-provider).

If the prompt is already strong, say so and make only minimal edits.
