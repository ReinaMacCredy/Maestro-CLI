# Step 2: Parse Input & Generate Feature Name

**Progress: Step 2 of 16** -- Next: Create Feature

## Goal
Extract feature description and generate a kebab-case feature name.

## Execution

1. Extract the feature description from `$ARGUMENTS`. If empty, ask the user: "What are you building? Describe the feature, fix, or change."

2. Auto-infer feature type from description keywords:
   - **feature**: add, build, create, implement, support, introduce
   - **bug**: fix, broken, error, crash, incorrect, regression, timeout, fail
   - **chore**: refactor, cleanup, migrate, upgrade, rename, reorganize, extract

   If ambiguous, confirm with the user.

3. Generate feature name: kebab-case, max 5 words.
   - Extract 2-5 key words from description
   - Convert to kebab-case
   - Example: "Add user authentication with OAuth" --> `user-auth-oauth`

4. Check existing features via `maestro feature-list` (CLI) or `maestro_feature_list` (MCP). Warn if a feature with a similar name already exists.

## Next Step
Read and follow `reference/steps/step-03-create-dir.md`.
