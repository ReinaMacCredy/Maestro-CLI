# Resume Protocol

## How to Detect an Interrupted Setup

In v2, there is no `setup_state.json`. Instead, detect setup completion by checking which global memory keys exist.

Check for existing memory entries:
```bash
maestro memory-list --global
```

## Resume Decision Tree

```
Does .maestro/ directory exist?
  |
  +-- NO  --> Fresh run. No resume needed. Run maestro init first, then continue to Step 3.
  |
  +-- YES --> Check which memory keys exist (product, tech-stack, guidelines, etc.)
        |
        +-- No memory keys --> .maestro/ was initialized but setup never ran. Treat as fresh.
        |
        +-- Some memory keys --> Partial setup. Offer resume or start over.
        |
        +-- All required keys present --> Setup was completed. Offer to update or skip.
```

Ask the user: "A previous setup run was interrupted.\n\nCompleted: {list of completed step names}\nRemaining: {list of remaining step names}\n\nWhat would you like to do?"
Options:
- **Resume from where I left off** -- Skip already-completed steps
- **Start over** -- Re-run all steps (existing memory entries used as defaults)

If "Start over": treat all steps as incomplete but pre-fill from existing memory.

If "Resume": skip steps whose memory keys already exist.

## Step Name Registry

Used for skip logic. A step is skipped if its corresponding memory key already exists:

| # | Step Name | What It Does | Memory Key |
|---|-----------|-------------|------------|
| 1 | `check_existing_context` | Check for prior context files | _none_ |
| 2 | `detect_maturity` | Brownfield/greenfield classification + scan | _none_ |
| 3 | `initialize_maestro` | `maestro init` | _presence of `.maestro/`_ |
| 4 | `product_definition` | Product purpose, users, features | `product` |
| 5 | `tech_stack` | Languages, frameworks, tools | `tech-stack` |
| 6 | `coding_guidelines` | Principles, conventions, NFRs | `guidelines` |
| 7 | `product_guidelines` | Voice, tone, UX, branding | `product-guidelines` |
| 8 | `workflow_config` | Methodology, commits, coverage | `workflow` |
| 9 | `style_guides` | Copy code style guides | _presence of `.maestro/memory/code_styleguides/`_ |
| 10 | `index_md` | Generate context index | `index` |
| 11 | `first_feature` | Optional first feature creation | _presence of any feature dir in `.maestro/features/`_ |

## Resume Verification

When resuming, verify that memory entries from completed steps actually exist:

```
For each completed step:
  Does the expected memory key exist?
    |
    +-- YES --> Step is truly complete. Skip it.
    |
    +-- NO  --> Step recorded as complete but memory is missing.
                Warn: "Step {name} was marked complete but {key} is missing."
                Ask: re-run this step, or skip anyway?
```

This handles cases where a user manually deleted files between sessions.
