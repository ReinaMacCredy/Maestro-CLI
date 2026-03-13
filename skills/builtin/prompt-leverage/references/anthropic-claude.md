# Claude Prompt Patterns

Distilled from Anthropic's official prompting best practices for Claude Opus 4.6, Sonnet 4.6, and Haiku 4.5. Focuses on prompt-level patterns only -- no API config, SDK code, or migration guides.

Last synced: 2026-03-13 (Claude 4.6 era)

## Clarity and Structure

**Golden rule:** Show your prompt to a colleague with minimal context. If they'd be confused, Claude will be too.

- Be specific about desired output format and constraints.
- Use numbered lists or bullet points when step order or completeness matters.
- Add modifiers for ambitious output: "Include as many relevant features as possible. Go beyond the basics to create a fully-featured implementation."

**Explain WHY, not just WHAT.** Claude generalizes from motivation better than from bare rules.

```
-- Weak: "NEVER use ellipses"
-- Strong: "Your response will be read aloud by a text-to-speech engine,
   so never use ellipses since the engine won't know how to pronounce them."
```

**XML tags** are Claude's primary structural mechanism. Use them to separate instructions, context, examples, and variable inputs. Consistent, descriptive tag names. Nest when content has natural hierarchy.

```xml
<documents>
  <document index="1">
    <source>report.pdf</source>
    <document_content>{{CONTENT}}</document_content>
  </document>
</documents>
```

**Roles** focus behavior. Even one sentence in the system prompt makes a difference: "You are a helpful coding assistant specializing in Python."

**Few-shot examples** are the most reliable way to steer output format, tone, and structure. Use 3-5 examples. Make them relevant, diverse, and wrapped in `<example>` tags so Claude distinguishes them from instructions.

## Long Context (20K+ tokens)

- Put longform data at the TOP of the prompt, above instructions and query. Queries at the end improve quality by up to 30%.
- Wrap each document in `<document>` tags with `<source>` metadata.
- Ask Claude to quote relevant parts before answering. Grounds the response and cuts noise.

## Output Control

**Tell Claude what TO DO, not what NOT to do.**

```
-- Weak: "Do not use markdown in your response"
-- Strong: "Your response should be composed of smoothly flowing prose paragraphs."
```

**XML format indicators** steer structure: "Write prose sections in `<smoothly_flowing_prose_paragraphs>` tags."

**Match your prompt style to the desired output.** Removing markdown from your prompt reduces markdown in the response.

**Minimize markdown block** (when needed):

```xml
<avoid_excessive_markdown_and_bullet_points>
Write in clear, flowing prose using complete paragraphs. Reserve markdown
for `inline code`, code blocks, and simple headings. Avoid **bold** and *italics*.
Do not use ordered or unordered lists unless presenting truly discrete items
or the user explicitly requests a list.
</avoid_excessive_markdown_and_bullet_points>
```

## Tool Use

**Be explicit about action vs suggestion.** Claude follows literal intent.

```
-- "Can you suggest some changes?" --> Claude suggests only
-- "Change this function to improve its performance." --> Claude acts
```

**Proactive action block:**

```xml
<default_to_action>
By default, implement changes rather than only suggesting them. If the user's
intent is unclear, infer the most useful likely action and proceed, using tools
to discover any missing details instead of guessing.
</default_to_action>
```

**Conservative action block** (when you want Claude to wait for explicit instruction):

```xml
<do_not_act_before_instructions>
Do not jump into implementation unless clearly instructed to make changes.
Default to providing information, research, and recommendations rather than
taking action.
</do_not_act_before_instructions>
```

**Parallel tool calling:**

```xml
<use_parallel_tool_calls>
Make all independent tool calls in parallel. Prioritize simultaneous calls
whenever actions can run concurrently. Do NOT parallelize calls that depend
on previous results. Never use placeholders or guess missing parameters.
</use_parallel_tool_calls>
```

**Dial back aggressive tool prompting.** Claude 4.6 is more responsive to system prompts than previous models. "CRITICAL: You MUST use this tool when..." will cause overtriggering. Use normal language: "Use this tool when..."

## Thinking and Reasoning

**Avoid overthinking.** Claude 4.6 does more upfront exploration than previous models. Tune guidance accordingly:

- Replace blanket defaults with targeted instructions. "Use [tool] when it would enhance your understanding" not "Default to using [tool]."
- Remove over-prompting. "If in doubt, use [tool]" causes overtriggering.
- Commit to an approach: "Choose an approach and commit. Avoid revisiting decisions unless new information directly contradicts your reasoning."

**Guide thinking after tool use:**

```
After receiving tool results, carefully reflect on their quality and determine
optimal next steps before proceeding.
```

**Reduce unnecessary thinking:**

```
Extended thinking adds latency and should only be used when it will meaningfully
improve answer quality -- typically for problems that require multi-step reasoning.
When in doubt, respond directly.
```

**Self-check pattern:** "Before you finish, verify your answer against [test criteria]." Catches errors reliably for coding and math.

**Manual CoT** (when thinking is off): Use `<thinking>` and `<answer>` tags to separate reasoning from output.

## Agentic Patterns

**Context persistence across windows:**

```
Your context window will be automatically compacted as it approaches its limit.
Do not stop tasks early due to token budget concerns. Save progress and state
to memory before the context window refreshes. Complete tasks fully.
```

**State management:** Use structured formats (JSON) for state data, freeform text for progress notes, git for checkpoints. Emphasize incremental progress.

**Multi-window setup:** Have the model write tests first (structured format), create setup scripts (`init.sh`), and track progress in a todo list. First window sets up the framework; subsequent windows iterate.

**Autonomy and safety balance:**

```
Consider the reversibility and potential impact of your actions. Take local,
reversible actions freely. For actions that are hard to reverse, affect shared
systems, or could be destructive, ask the user before proceeding.
```

**Structured research:**

```
Search in a structured way. Develop competing hypotheses. Track confidence levels.
Regularly self-critique your approach. Update a research notes file for
transparency. Break down the task systematically.
```

**Subagent discipline:** Claude 4.6 overuses subagents. Add guidance:

```
Use subagents for parallel tasks, isolated context, or independent workstreams.
For simple tasks, sequential operations, or single-file edits, work directly.
```

## Common Pitfalls to Address

**Overeagerness / overengineering:**

```xml
<scope_discipline>
Only make changes that are directly requested or clearly necessary.
- Don't add features or refactor beyond what was asked.
- Don't add docstrings or type annotations to unchanged code.
- Don't add error handling for impossible scenarios.
- Don't create abstractions for one-time operations.
</scope_discipline>
```

**Test-focused hard-coding:**

```
Implement a general-purpose solution. Do not hard-code values that only work
for specific test inputs. Tests verify correctness -- they don't define the solution.
```

**Hallucination prevention:**

```xml
<investigate_before_answering>
Never speculate about code you have not opened. Read relevant files BEFORE
answering questions about the codebase. Never make claims about code before
investigating.
</investigate_before_answering>
```

**File creation sprawl:**

```
If you create temporary files, scripts, or helpers for iteration, clean them up
by removing them at the end of the task.
```
