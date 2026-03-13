# Anthropic Claude Prompt Guidance

Best practices for Claude Opus 4.6, Sonnet 4.6, and Haiku 4.5.
Source: Anthropic Claude Prompting Best Practices.

## Structure with XML Tags

XML tags help Claude parse complex prompts unambiguously. Wrap each type of content in its own tag (`<instructions>`, `<context>`, `<input>`) to reduce misinterpretation.

- Use consistent, descriptive tag names across prompts.
- Nest tags when content has a natural hierarchy (e.g., `<documents>` containing `<document index="n">`).

## Give Claude a Role

Setting a role in the system prompt focuses behavior and tone. Even a single sentence makes a difference. Place it at the start of the system prompt.

## Use Examples Effectively (Few-Shot Prompting)

Examples are one of the most reliable ways to steer output format, tone, and structure.

- Make examples relevant, diverse, and structured.
- Wrap in `<example>` tags (multiple in `<examples>` tags) so Claude distinguishes them from instructions.
- 3-5 examples for best results.
- You can include `<thinking>` tags inside few-shot examples to show the reasoning pattern.

## Control Output Formatting

1. Tell Claude what to do instead of what not to do. ("Write in flowing prose paragraphs" instead of "Do not use markdown").
2. Use XML format indicators (`<smoothly_flowing_prose_paragraphs>` tags).
3. Match your prompt style to the desired output style.
4. Provide detailed formatting instructions for complex outputs.

## Thinking and Reasoning

- Claude Opus 4.6 uses adaptive thinking (`thinking: {type: "adaptive"}`).
- Claude Sonnet 4.6 supports both adaptive and manual extended thinking with interleaved mode.
- Prefer general instructions ("think thoroughly") over prescriptive step-by-step plans.
- Multishot examples work with thinking -- include `<thinking>` tags in examples.
- Add explicit instructions to constrain excessive thinking when undesirable.

## Agentic Coding Patterns

- Claude may create temporary files as scratchpads. Instruct cleanup if undesired.
- Claude 4.6 models are proactive and may overtrigger on instructions needed for older models. Remove heavy-handed constraints that were workarounds for older model limitations.
- Frame instructions with modifiers that encourage quality: "Include as many relevant features as possible. Go beyond the basics."
- Request specific features explicitly -- animations, interactivity, etc.

## Context Management

- If using a harness that compacts context, tell Claude so it does not prematurely wrap up work.
- Tell Claude its context limits and what happens when they are reached.

## Avoid Overengineering Prompts

- Scope: do not add features beyond what was asked.
- Documentation: do not add comments to code you did not change.
- Error handling: only validate at system boundaries.
- Abstractions: do not create helpers for one-time operations.
