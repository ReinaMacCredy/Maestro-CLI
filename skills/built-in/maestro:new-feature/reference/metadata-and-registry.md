# Feature Registration

## feature.json

The `feature.json` file is created automatically by `maestro_feature_create`. After the design process completes, update it with additional fields:

```json
{
  "name": "<feature-name>",
  "type": "{feature | bug | chore}",
  "status": "planning",
  "description": "<feature description>",
  "created_at": "{ISO 8601 timestamp}",
  "updated_at": "{ISO 8601 timestamp}",
  "phases": "{phase_count}",
  "tasks": "{task_count}",
  "skills": [
    {
      "name": "skill-name",
      "relevance": "matched",
      "matched_on": ["keyword1", "keyword2"]
    }
  ],
  "beads_epic_id": "{br_epic_id | null}",
  "beads_issue_map": {
    "01-setup-auth": "{br_issue_id}",
    "02-add-routes": "{br_issue_id}"
  }
}
```

Note: `"skills"` is `[]` if no skills were detected.

Note: `"beads_epic_id"` and `"beads_issue_map"` are set by the plan-to-BR sync step (Step 9.7). If BR sync was skipped or failed, omit both fields. When present, `beads_epic_id` is the discriminator that tells downstream skills to use BR for state tracking.

Located at `.maestro/features/<feature-name>/feature.json`.

## Feature Listing

Use `maestro feature-list` (CLI) or `maestro_feature_list` (MCP) to view all features and their statuses. No manual registry file is needed -- the feature list is computed from `.maestro/features/*/feature.json`.

## Commit

```bash
git add .maestro/features/<feature-name>
git commit -m "chore(maestro:new-feature): add feature <feature-name>"
```

## Summary Output

```
## Feature Created

**{feature description}**
- Name: `<feature-name>`
- Type: {type}
- Phases: {count}
- Tasks: {count}

**Files**:
- `.maestro/features/<feature-name>/spec.md`
- `.maestro/features/<feature-name>/plan.md`
- `.maestro/features/<feature-name>/feature.json`

**Next**: `maestro plan-approve --feature <feature-name>` then `maestro tasks-sync --feature <feature-name>`
```
