# Git Operations for Revert

Detailed protocols for SHA resolution, reconciliation, execution, task state management, and advanced recovery strategies.

---

## Step 3: Resolve Commit SHAs

### 3a: Extract Implementation SHAs

**Task state source**: Call `maestro_task_list` or `maestro_status` to get all tasks with their summaries. Task summaries from `maestro_task_done` include commit SHAs (format: `sha: {7char}` in the summary text).

**BR-enhanced path**: If `feature.json` has `beads_epic_id`:
- Use `br list --status closed --parent {epic_id} --all --json` to get all closed issues
- Parse the `close_reason` field for SHAs (format: `sha:{7char}`)
- Scope by labels: `--label "phase:{N}"` for phase-level, match task title for task-level
- Falls back to task summary parsing if BR command fails or returns no results

**Task summary path**: Parse commit SHAs from the task summaries available via `maestro_task_list`:
- **Feature**: All tasks in `done` state, extract SHAs from summaries
- **Phase N**: Only `done` tasks belonging to phase N
- **Task**: Only the specific task's summary

### 3b: Identify Plan-Update Commits

Search for commits that updated maestro state for this feature:

```bash
git log --oneline --all --grep="maestro(plan): mark task" -- .maestro/features/{feature-name}/plan.md
```

Add any matching SHAs to the revert list alongside the implementation commits.

### 3c: Identify Feature Creation Commit (feature-level revert only)

If reverting the entire feature:

```bash
git log --oneline --all --grep="chore(maestro)" -- .maestro/features/{feature-name}/
```

If found, add this SHA to the revert list so the feature files are also removed.

If no SHAs found in scope (no implementation SHAs from 3a, and no plan-update commits from 3b):
- Report: "No completed tasks found in the specified scope. Nothing to revert."
- Stop.

### 3d: Edge Case -- Commits on Multiple Branches

If the feature's commits span multiple branches (e.g., feature branch merged to main):

```bash
# Find all branches containing each SHA
for sha in {sha_list}; do
  echo "$sha: $(git branch --all --contains $sha | tr '\n' ', ')"
done
```

If a commit exists on multiple branches, reverting it on one branch does not affect the other. Warn the user:

"Commit {sha} exists on branches: {branch_list}. The revert will only apply to the current branch ({current_branch}). Other branches retain the original commit."

### 3e: Edge Case -- Interactive Rebase Has Rewritten History

If task summaries reference SHAs that no longer exist (due to `git rebase -i`):

```bash
# Check reflog for original commits
git reflog | grep "{partial_sha}"

# Search by commit message instead
git log --all --oneline --grep="{task description}"
```

If the rebase squashed multiple commits into one:
- The single squashed commit may contain changes from multiple tasks
- Warn: "Commit {original_sha} was squashed into {new_sha} during rebase. Reverting {new_sha} will undo ALL tasks in the squash, not just this one."
- Offer partial revert via `git revert -n` (see Step 7 edge cases)

---

## Step 4: Git Reconciliation

For each SHA in the combined revert list, verify it exists:

```bash
git cat-file -t {sha}
```

CRITICAL: Validate this command succeeds for each SHA before continuing.

**If SHA exists**: Add to revert list.

**If SHA is missing** (rebased, squashed, or force-pushed):
- Warn: "Commit {sha} no longer exists (likely rewritten by rebase/squash)."
- Try to find the replacement:
  ```bash
  git log --all --oneline --grep="{original commit message}"
  ```
- If found: offer to use the replacement SHA
- If not found: skip this commit and warn user

### 4a: Merge Commit Detection

For each SHA that exists:

```bash
git cat-file -p {sha}
```

If two or more `parent` lines are present, it is a merge commit. Warn for each:

"Commit {sha} is a merge commit. Reverting merge commits may have unexpected results."

Ask the user: "One or more commits to revert are merge commits ({sha_list}). How should we proceed?"
Options:
- **Proceed anyway** -- Attempt git revert with -m 1 for merge commits
- **Skip merge commits** -- Exclude merge commits from the revert list
- **Cancel** -- Abort the revert

### 4b: Cherry-pick Duplicate Detection

Compare commit messages across all SHAs:

```bash
git log --format="%H %s" {sha1} {sha2} ...
```

For any two commits with identical subject lines, compare patches:

```bash
git diff {sha_a}^ {sha_a}
git diff {sha_b}^ {sha_b}
```

If patches are substantively identical, treat as duplicates. Remove the older duplicate:

"Deduplicated: {sha_older} is a cherry-pick of {sha_newer} -- keeping only {sha_newer} in the revert list."

### 4c: Ordering Validation

Before executing, sort the revert list in reverse chronological order:

```bash
git log --format="%H %ct" {sha1} {sha2} ... | sort -k2 -rn
```

Reverting out of order can cause unnecessary conflicts. Always revert newest first.

---

## Step 7: Execute Reverts

Revert commits in **reverse chronological order** (newest first).

For standard commits:
```bash
git revert --no-edit {sha_newest}
git revert --no-edit {sha_next}
```

For merge commits (if user chose "Proceed anyway"):
```bash
git revert --no-edit -m 1 {merge_sha}
```

CRITICAL: Validate each `git revert` command succeeds before continuing.

**On conflict**:
1. Report: "Merge conflict during revert of {sha}."
2. Show conflicting files: `git diff --name-only --diff-filter=U`
3. Ask the user: "Merge conflict in {file}. How should we proceed?"
   Options:
   - **Help me resolve** -- Show me the conflict and I'll guide resolution
   - **Abort revert** -- Cancel remaining reverts (already-reverted commits stay)
   - **Accept theirs** -- Keep the current version (discard the revert for this file)

After resolving conflicts: `git add {resolved_files} && git revert --continue`

### 7a: Edge Case -- Partial Revert (some files from a commit)

If a commit contains changes to files across multiple tasks and only one task should be reverted:

```bash
# Stage the revert without committing
git revert -n {sha}

# Unstage files that should NOT be reverted
git reset HEAD {file_to_keep_1} {file_to_keep_2}
git checkout -- {file_to_keep_1} {file_to_keep_2}

# Commit only the desired reverts
git commit -m "Revert partial: {task_name} from {sha7}"
```

This is complex and error-prone. Warn the user and confirm before proceeding.

### 7b: Edge Case -- Batch Revert with Single Commit

If the user prefers a single revert commit instead of one per original commit:

```bash
# Stage all reverts without committing
git revert -n {sha_newest}
git revert -n {sha_next}
# ...for each SHA

# Create single commit
git commit -m "Revert {scope}: {feature_description}"
```

Trade-off: cleaner history but harder to undo individual parts of the batch.

---

## Step 8: Update Task State

For each reverted task, reset its state to `pending`. Update the task state files in `.maestro/features/{feature-name}/tasks/`.

**BR mirror**: If `feature.json` has `beads_epic_id`, also reopen the corresponding BR issues:

```bash
br update {issue_id} --status open --json
```

Look up `{issue_id}` from `feature.json` `beads_issue_map` for each reverted task.

```bash
git add .maestro/features/{feature-name}/
git commit -m "maestro(revert): update task state for reverted {scope}"
```

CRITICAL: Validate the commit succeeds.

## Step 9: Update Feature State (if feature-level revert)

If the entire feature was reverted and the feature creation commit was NOT in the revert list:
- Update `feature.json`: set status back to `approved` or `executing` as appropriate

```bash
git add .maestro/features/{feature-name}/feature.json
git commit -m "maestro(revert): reset feature {feature-name} status"
```

If the feature creation commit WAS reverted, the feature files were already removed -- skip this step.

## Step 10: Verify

```bash
CI=true {test_command}
```

CRITICAL: Validate this command completes. Report exit code and output summary.
- **Tests pass**: Report success.
- **Tests fail**: Warn user and offer to debug. Common causes after revert:
  - Orphaned imports referencing reverted code
  - Test files that were added by the reverted commits (revert removes them, but test runner config may still reference them)
  - Database migrations that were applied but not rolled back

---

## Branch Recreation Protocol

When history is too tangled for `git revert` (e.g., extensive rebasing, squashing, and cherry-picking has created a web of dependencies):

### When to use branch recreation

- Multiple reverts would conflict with each other
- The commit graph has been heavily rewritten and SHAs cannot be resolved
- User explicitly requests a clean-slate approach

### Steps

```bash
# 1. Identify the known-good point (before feature implementation started)
git log --oneline --before="{feature_start_date}" | head -5
# Or use the commit just before the first feature commit
good_point={sha_before_feature}

# 2. Create new branch from the good point
git checkout -b {branch}-recreated $good_point

# 3. Cherry-pick any commits you want to KEEP (non-feature commits that happened after)
git log --oneline $good_point..{original_branch} --no-merges
# Review each commit -- cherry-pick only non-feature ones
git cherry-pick {keeper_sha1}
git cherry-pick {keeper_sha2}

# 4. Verify
CI=true {test_command}

# 5. Replace original branch (DESTRUCTIVE -- confirm with user)
git branch -m {original_branch} {original_branch}-backup
git branch -m {branch}-recreated {original_branch}
```

### After branch recreation

- The `-backup` branch preserves the original history
- Update maestro task state: all feature tasks reset to `pending`
- Keep the backup branch for at least 30 days
- Delete with `git branch -D {original_branch}-backup` only after confirming everything works
