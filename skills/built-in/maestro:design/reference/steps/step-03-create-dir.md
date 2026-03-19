# Step 3: Create Feature

**Progress: Step 3 of 16** -- Next: Project Classification

## Goal
Create the feature using the maestro tool.

## Execution

Create the feature via `maestro feature-create` (CLI) or `maestro_feature_create` (MCP):

```bash
maestro feature-create --name <feature-name> --description "<feature description>"
```

Or via MCP:
```
maestro_feature_create({ name: "<feature-name>", description: "<feature description>" })
```

This creates the feature directory at `.maestro/features/<feature-name>/` with `feature.json` and the required structure.

## Next Step
Read and follow `reference/steps/step-04-classification.md`.
