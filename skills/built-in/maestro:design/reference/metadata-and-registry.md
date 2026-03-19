# Feature Metadata and Registry

## feature.json

The `feature.json` file is created by `maestro_feature_create` / `maestro feature-create`. After design completes, update it with additional fields:

```json
{
  "name": "<feature-name>",
  "type": "{feature | bug | chore}",
  "status": "planning",
  "description": "{feature description}",
  "created_at": "{ISO 8601 timestamp}",
  "updated_at": "{ISO 8601 timestamp}",
  "phases": {phase_count},
  "tasks": {task_count},
  "skills": [
    {
      "name": "skill-name",
      "relevance": "matched",
      "matched_on": ["keyword1", "keyword2"]
    }
  ],
  "beads_epic_id": "{br_epic_id | null}",
  "beads_issue_map": {
    "P1T1": "{br_issue_id}",
    "P1T2": "{br_issue_id}"
  }
}
```

Note: `"skills"` is `[]` if no skills were detected.

Note: `"beads_epic_id"` and `"beads_issue_map"` are set by the plan-to-BR sync step (Step 14). If BR sync was skipped or failed, omit both fields. When present, `beads_epic_id` is the discriminator that tells downstream skills to use BR for state tracking.

Lives at `.maestro/features/<feature-name>/feature.json`.

## Feature Listing

Use `maestro feature-list` (CLI) or `maestro_feature_list` (MCP) to view all features. There is no manual registry file to maintain -- the feature list is derived from `.maestro/features/` directory contents.

## Commit

```bash
git add .maestro/features/<feature-name>
git commit -m "chore(maestro:design): add feature <feature-name>"
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
