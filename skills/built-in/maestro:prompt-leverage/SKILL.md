---
name: maestro:prompt-leverage
description: Strengthen a raw user prompt into an execution-ready instruction set for Amp, Claude Code, or another AI agent. Use when the user wants to improve an existing prompt, build a reusable prompting framework, wrap the current request with better structure, add clearer tool rules, or create a hook that upgrades prompts before execution.
---

# Prompt Leverage

Turn the user's current prompt into a stronger working prompt without changing the underlying intent. Preserve the task, fill in missing execution structure, and add only enough scaffolding to improve reliability.

## Workflow

1. Read the raw prompt and identify the real job to be done.
2. Infer the task type: coding, research, writing, analysis, planning, or review.
3. Identify the target model family if specified or implied (see Provider References below).
4. Rebuild the prompt with the framework blocks in `reference/framework.md`.
5. If a specific provider is targeted, consult the relevant vendor reference for provider-specific patterns.
6. Keep the result proportional: do not over-specify a simple task.
7. Return both the improved prompt and a short explanation of what changed when useful.

## Transformation Rules

- Preserve the user's objective, constraints, and tone unless they conflict.
- Prefer adding missing structure over rewriting everything stylistically.
- Add context requirements only when they improve correctness.
- Add tool rules only when tool use materially affects correctness.
- Add verification and completion criteria for non-trivial tasks.
- Keep prompts compact enough to be practical in repeated use.

## Framework Blocks

Use these blocks selectively.

- `Objective`: state the task and what success looks like.
- `Context`: list sources, files, constraints, and unknowns.
- `Work Style`: set depth, breadth, care, and first-principles expectations.
- `Tool Rules`: state when tools, browsing, or file inspection are required.
- `Output Contract`: define structure, formatting, and level of detail.
- `Verification`: require checks for correctness, edge cases, and better alternatives.
- `Done Criteria`: define when the agent should stop.

## Provider References

Three reference files support prompt construction:

- `reference/framework.md` -- vendor-neutral framework. Always loaded.
- `reference/anthropic-claude.md` -- Claude-specific patterns. Loaded for Claude targets.
- `reference/openai-gpt.md` -- GPT-specific patterns. Loaded for GPT targets.

### Detection: which reference to load

**Anthropic / Claude family** --> load `anthropic-claude.md`

Keywords: "Claude", "Claude Code", "Anthropic", "Sonnet", "Opus", "Haiku"
Model IDs: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`, or any `claude-*` string
Version patterns: "Claude 3", "Claude 3.5", "Claude 4", "Claude 4.5", "Claude 4.6", "Claude 5" and beyond
Prompt signals: XML tags (`<instructions>`, `<context>`, `<thinking>`), `adaptive thinking`, `budget_tokens`, `effort` parameter in Anthropic context, system prompt role-setting

**OpenAI / GPT family** --> load `openai-gpt.md`

Keywords: "GPT", "OpenAI", "ChatGPT", "Codex"
Model IDs: `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.2`, `gpt-5`, `gpt-4.1`, `gpt-4o`, or any `gpt-*` string
Reasoning models: "o1", "o3", "o4-mini", or any `o[0-9]*` pattern
Version patterns: "GPT-4", "GPT-4o", "GPT-5", "GPT-5.4" and beyond
Prompt signals: `<output_contract>`, `<verification_loop>`, `reasoning_effort`, `phase` parameter, Responses API references

**Other / unspecified** --> `framework.md` only

Keywords: "Amp", "Cursor", "Windsurf", "Copilot", "Gemini", "Llama", "Mistral", or no model mentioned
Also: generic requests like "improve this prompt" with no provider-specific patterns

When no provider is detected, the vendor-neutral framework produces strong prompts for any model. Only load one vendor file at a time -- never both.

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

Before finalizing, check the upgraded prompt:

- still matches the original intent
- does not add unnecessary ceremony
- includes the right verification level for the task
- gives the agent a clear definition of done

If the prompt is already strong, say so and make only minimal edits.
