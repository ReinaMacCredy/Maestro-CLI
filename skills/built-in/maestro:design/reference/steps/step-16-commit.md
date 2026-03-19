# Step 16: Feature Registration, Commit & Summary

**Progress: Step 16 of 16** -- Complete

## Goal
Update feature.json, commit all feature files, and display summary.

## Execution Rules
- You MUST follow `reference/metadata-and-registry.md` for all schemas and formats
- Commit message format: `chore(maestro:design): add feature <feature-name>`
- Summary MUST include feature name, type, phase/task counts, and next step

## Execution Sequence

1. **Read Schema**
   Read `reference/metadata-and-registry.md` for feature.json schema and summary format.

2. **Update feature.json**
   The feature.json was created by `maestro_feature_create` in step 3. Update it with:
   - phases and tasks counts (from plan.md)
   - skills: [] (or detected skills from step 13)
   - beads_epic_id and beads_issue_map (from step 14, if applicable)

   The feature.json lives at `.maestro/features/<feature-name>/feature.json`.

3. **Commit**
   ```bash
   git add .maestro/features/<feature-name>
   # Include beads state if BR sync was performed
   [ -d ".beads" ] && git add .beads/
   git commit -m "chore(maestro:design): add feature <feature-name>"
   ```

4. **Display Summary**
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

## Quality Checks
- [ok] feature.json updated with phase/task counts and skills
- [ok] Git commit successful with correct message format
- [ok] Summary displayed with correct counts and next step

## Anti-patterns
- [x] Wrong commit message format (must be `chore(maestro:design):` prefix)
- [x] Missing phase/task counts in summary
- [x] Not showing the next step
- [x] Committing before all files are written
