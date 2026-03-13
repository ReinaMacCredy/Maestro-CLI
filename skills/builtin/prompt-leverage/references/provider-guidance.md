# Provider-Specific Prompt Guidance

Best practices extracted from official documentation. Each provider has its own reference file for independent maintenance:

- `references/anthropic-guidance.md` -- Claude Opus 4.6, Sonnet 4.6, Haiku 4.5
- `references/openai-guidance.md` -- GPT-5.4 and later

Consult the relevant file when targeting a specific model family. When the target is unknown or the prompt should be portable, use the cross-provider principles below.

## Cross-Provider Principles

These patterns work well regardless of provider:

1. **Be specific about success**: observable criteria over vague adjectives.
2. **Structure with tags**: XML tags reduce ambiguity in complex prompts.
3. **Use examples**: few-shot prompting is universally effective for format and tone.
4. **Define done**: explicit completion criteria prevent premature stopping or infinite loops.
5. **Verify before finishing**: a self-check step catches errors the main pass misses.
6. **Match intensity to task**: simple tasks need minimal scaffolding; complex tasks need full framework.
7. **Preserve user intent**: upgrade structure, not substance.
8. **Tell what to do, not what to avoid**: positive instructions outperform negative ones.
9. **Remove stale constraints**: instructions that worked around older model limitations may hurt newer models.
