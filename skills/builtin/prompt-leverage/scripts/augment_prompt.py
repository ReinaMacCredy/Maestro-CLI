#!/usr/bin/env python3
"""Deterministic first-pass prompt upgrader.

Classifies a raw prompt by task type, infers intensity, and wraps it
with framework blocks (objective, context, work style, tool rules,
output contract, verification, done criteria).

Usage:
    python augment_prompt.py "your raw prompt here"
    python augment_prompt.py --task coding "fix the auth bug in login.py"
    echo "analyze our Q4 metrics" | python augment_prompt.py --stdin
"""

from __future__ import annotations

import argparse
import re
import sys
from textwrap import dedent


TASK_KEYWORDS: dict[str, list[str]] = {
    "coding": [
        "code", "bug", "repo", "refactor", "test", "implement", "fix",
        "function", "api", "commit", "merge", "deploy", "lint", "build",
    ],
    "research": [
        "research", "compare", "find", "latest", "sources",
        "analyze market", "look up", "investigate", "survey",
    ],
    "writing": [
        "write", "rewrite", "draft", "email", "memo", "blog",
        "copy", "tone", "article", "document", "summary",
    ],
    "review": [
        "review", "audit", "critique", "inspect", "evaluate", "assess",
    ],
    "planning": [
        "plan", "roadmap", "strategy", "framework", "outline",
        "architect", "design", "scope",
    ],
    "analysis": [
        "analyze", "explain", "break down", "diagnose", "root cause",
        "debug", "profile", "benchmark",
    ],
}

DEFAULT_TASK = "analysis"

INTENSITY_DEEP = "Deep"
INTENSITY_STANDARD = "Standard"
INTENSITY_LIGHT = "Light"

DEEP_SIGNAL_TOKENS = [
    "careful", "deep", "thorough", "high stakes",
    "production", "critical", "security", "compliance",
]

INTENSIVE_TASKS = {"coding", "research", "review"}


def detect_task(lowered: str) -> str:
    scores = {
        task: sum(1 for keyword in keywords if keyword in lowered)
        for task, keywords in TASK_KEYWORDS.items()
    }
    best_task, best_score = max(scores.items(), key=lambda item: item[1])
    return best_task if best_score > 0 else DEFAULT_TASK


def infer_intensity(lowered: str, task: str) -> str:
    if any(token in lowered for token in DEEP_SIGNAL_TOKENS):
        return INTENSITY_DEEP
    if task in INTENSIVE_TASKS:
        return INTENSITY_STANDARD
    return INTENSITY_LIGHT


def build_tool_rules(task: str) -> str:
    if task == "coding":
        return (
            "Inspect the relevant files and dependencies first. "
            "Validate the final change with the narrowest useful checks "
            "before broadening scope."
        )
    if task == "research":
        return (
            "Retrieve evidence from reliable sources before concluding. "
            "Do not guess facts that can be checked."
        )
    if task == "review":
        return (
            "Read enough surrounding context to understand intent before "
            "critiquing. Distinguish confirmed issues from plausible risks."
        )
    return (
        "Use tools or extra context only when they materially improve "
        "correctness or completeness."
    )


def build_output_contract(task: str) -> str:
    if task == "coding":
        return (
            "Return the result in a practical execution format: concise "
            "summary, concrete changes or code, validation notes, and any "
            "remaining risks."
        )
    if task == "research":
        return (
            "Return a structured synthesis with key findings, supporting "
            "evidence, uncertainty where relevant, and a concise bottom line."
        )
    if task == "writing":
        return (
            "Return polished final copy in the requested tone and format. "
            "If useful, include a short rationale for major editorial choices."
        )
    if task == "review":
        return (
            "Return findings grouped by severity or importance, explain "
            "why each matters, and suggest the smallest credible next step."
        )
    return (
        "Return a clear, well-structured response matched to the task, "
        "with no unnecessary verbosity."
    )


def upgrade_prompt(raw_prompt: str, task: str | None = None) -> str:
    normalized = re.sub(r"\s+", " ", raw_prompt).strip()
    lowered = normalized.lower()
    detected_task = task or detect_task(lowered)
    intensity = infer_intensity(lowered, detected_task)
    tool_rules = build_tool_rules(detected_task)
    output_contract = build_output_contract(detected_task)

    return dedent(f"""\
        <objective>
        {normalized}
        </objective>

        <context>
        Task type: {detected_task} | Intensity: {intensity}
        Provide any additional context (files, URLs, constraints) that improves correctness.
        </context>

        <work_style>
        - {"Go broad first to understand the system, then deep where risk is highest." if intensity == INTENSITY_DEEP else "Focus on the specific task. Broaden scope only if needed."}
        - Use first-principles reasoning before making changes.
        - {"Re-check with fresh eyes before finalizing." if intensity != INTENSITY_LIGHT else "Keep it simple and direct."}
        </work_style>

        <tool_rules>
        {tool_rules}
        </tool_rules>

        <output_contract>
        {output_contract}
        </output_contract>

        <verification>
        - Re-read the result against the original request.
        - {"Check for factual grounding and completeness." if intensity != INTENSITY_LIGHT else "Quick sanity check."}
        - {"Ask: is there a simpler or more elegant approach?" if intensity == INTENSITY_DEEP else ""}
        </verification>

        <done_criteria>
        Stop only when the response satisfies the task, matches the requested format, and passes the verification step.
        </done_criteria>
    """).strip()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Upgrade a raw prompt with framework blocks."
    )
    parser.add_argument("prompt", nargs="?", help="The raw prompt to upgrade.")
    parser.add_argument(
        "--task",
        choices=list(TASK_KEYWORDS.keys()),
        default=None,
        help="Override detected task type.",
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read prompt from stdin.",
    )

    args = parser.parse_args()

    if args.stdin:
        raw = sys.stdin.read().strip()
    elif args.prompt:
        raw = args.prompt
    else:
        parser.error("Provide a prompt as an argument or use --stdin.")

    print(upgrade_prompt(raw, args.task))


if __name__ == "__main__":
    main()
