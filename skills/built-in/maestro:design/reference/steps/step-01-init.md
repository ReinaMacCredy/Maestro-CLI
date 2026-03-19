# Step 1: Validate Prerequisites

**Progress: Step 1 of 16** -- Next: Parse Input

## Goal
Verify the project is set up for maestro features before proceeding.

## Execution

1. Call `maestro_status` (MCP) or `maestro status` (CLI) to check project state. If maestro is not initialized (no `.maestro/` directory): tell the user "Run `maestro init` first to initialize the project." Stop.

2. Check that global memory has a `product` key (via `maestro_memory_list` or `maestro memory-list --global`). If missing: tell the user "Run `/maestro:setup` first to initialize project context." Stop.

3. Read the `product` memory entry to understand the project. Keep this context for later steps.

## Next Step
Read and follow `reference/steps/step-02-parse-input.md`.
