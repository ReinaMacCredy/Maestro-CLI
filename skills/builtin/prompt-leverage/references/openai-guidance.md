# OpenAI GPT Prompt Guidance

Best practices for GPT-5.4 and later.
Source: OpenAI Prompt Guidance for GPT-5.4.

## Use Core Prompt Patterns

GPT-5.4 performs best with modular, block-structured prompts where the contract is explicit. Key patterns:

### Output Contract

```
<output_contract>
- Return exactly the sections requested, in the requested order.
- If a format is required (JSON, Markdown, SQL, XML), output only that format.
- Apply length limits only to the section they are intended for.
</output_contract>
```

### Verbosity Controls

```
<verbosity_controls>
- Prefer concise, information-dense writing.
- Avoid repeating the user's request.
- Keep progress updates brief.
- Do not omit required evidence or reasoning.
</verbosity_controls>
```

### Tool Persistence Rules

```
<tool_persistence_rules>
- Use tools whenever they materially improve correctness.
- Do not stop early when another tool call would improve the result.
- Keep calling tools until the task is complete and verification passes.
- If a tool returns empty or partial results, retry with a different strategy.
</tool_persistence_rules>
```

### Dependency Checks

```
<dependency_checks>
- Before taking an action, check whether prerequisite discovery or lookup steps are needed.
- Do not skip prerequisites just because the intended final action seems obvious.
- If the task depends on output of a prior step, resolve that dependency first.
</dependency_checks>
```

## Set Clear Defaults for Follow-Through

Define rules for when to proceed vs. when to ask:

- If intent is clear and next step is reversible and low-risk, proceed.
- Ask only if the next step is irreversible, costly, or requires missing information.
- Make instruction priority explicit: user instructions override defaults; safety constraints do not yield.

## Reasoning Effort as a Tuning Knob

Reasoning effort is not one-size-fits-all. Before increasing reasoning, first add:

- `<completeness_contract>` -- what counts as a complete answer.
- `<verification_loop>` -- self-check before finishing.
- `<tool_persistence_rules>` -- thorough tool use.

Start with minimal reasoning for execution-heavy tasks. Reserve higher reasoning for research-heavy or multi-document synthesis tasks.

## Strict Output Formats

For parse-sensitive outputs (SQL, JSON), tell the model to emit only the target format and validate before finishing:

```
<structured_output_contract>
- Output only the requested format.
- Do not add prose or markdown fences unless requested.
- Validate that parentheses and brackets are balanced.
- Do not invent fields or tables.
</structured_output_contract>
```

## GPT-5.4 Strengths to Leverage

- Strong personality and tone adherence with less drift over long outputs.
- Robust agentic workflows: sticks with multi-step work, retries, completes loops.
- Evidence-rich synthesis in long-context or multi-tool workflows.
- Instruction adherence in modular, block-structured prompts.
- Batched or parallel tool calling with maintained accuracy.

## Migration Notes

When migrating prompts between model versions:

- Change one thing at a time: switch model first, pin reasoning effort, run evals, then iterate.
- GPT-5.4 may need less hand-holding than older models -- remove overly prescriptive constraints.
- Start with `none` reasoning for execution-heavy workloads, `medium` for research-heavy.
