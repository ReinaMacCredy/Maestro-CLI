# Specification: Skills System Full Port

## Overview
Port the reference skills implementation from `/Users/reinamaccredy/Code/maestro/skills` into maestroCLI's built-in skills system. This adds reference file support (skills can bundle `reference/` subdirectories), progressive disclosure (load references on-demand via `loadSkillReference()`), content gates step protocol (no system enforcement), `argument-hint` frontmatter, colon-prefixed naming (`maestro:*`), and merged/ported skill content from both codebases.

## Type
feature

## Requirements

### Functional Requirements
1. **FR-1: Reference file support** -- Built-in skills can contain `reference/` subdirectories with arbitrary markdown files. These are embedded at build time alongside the skill's `SKILL.md` content.
2. **FR-2: `loadSkillReference(name, path)` API** -- New registry function that loads a specific reference file from a skill's `reference/` directory. Returns file content or error. Works for both built-in (embedded) and internal (filesystem) skills.
3. **FR-3: Colon-prefixed naming** -- All built-in skills use `maestro:` prefix (e.g., `maestro:design`, `maestro:brainstorming`). Directory names on disk use `maestro:` prefix. Registry handles name normalization.
4. **FR-4: `argument-hint` frontmatter** -- Skills can declare an `argument-hint` field in YAML frontmatter. Displayed by `skill-list` and available via the registry API.
5. **FR-5: Merged overlapping skills** -- Four skill pairs merged (richer reference version as base, current unique content folded in):
   - `agents-md-mastery` + `maestro:AGENTS.md` --> `maestro:agents-md`
   - `writing-plans` + `maestro:design` --> `maestro:design`
   - `executing-plans` + `maestro:implement` --> `maestro:implement`
   - `code-reviewer` + `maestro:review` --> `maestro:review`
6. **FR-6: Renamed non-overlapping skills** -- Eight current skills renamed to colon prefix:
   - `brainstorming` --> `maestro:brainstorming`
   - `dispatching-parallel-agents` --> `maestro:dispatching`
   - `docker-mastery` --> `maestro:docker`
   - `parallel-exploration` --> `maestro:parallel-exploration`
   - `prompt-leverage` --> `maestro:prompt-leverage`
   - `systematic-debugging` --> `maestro:debugging`
   - `test-driven-development` --> `maestro:tdd`
   - `verification-before-completion` --> `maestro:verification`
7. **FR-7: New skills from reference** -- Six new skills ported:
   - `maestro:new-track` -- specification and planning
   - `maestro:note` -- decision/context notepad
   - `maestro:revert` -- git-aware undo
   - `maestro:setup` -- project context scaffolding
   - `maestro:status` -- track progress overview
   - `maestro:symphony-setup` -- extended setup with codex skills
8. **FR-8: Progressive disclosure** -- Skills serve content in layers: metadata (name + description + argument-hint) via `listSkills()`, full SKILL.md body via `loadSkill()`, individual reference files via `loadSkillReference()`.
9. **FR-9: Content gates step protocol** -- Multi-step skills (e.g., `maestro:design` with 16 steps) self-manage sequencing via instructions in the content. Each step file tells the agent what to load next. No system-level step tracking or enforcement.

### User Interaction
- Interaction type: CLI + MCP
- Entry points:
  - `maestro skill maestro:design` -- loads skill body
  - `maestro skill maestro:design --ref steps/step-01.md` -- loads reference file
  - `maestro skill-list` -- lists all skills with argument hints
  - MCP tool `maestro_skill` with optional `reference` parameter
- Output: Skill content (markdown) printed to stdout or returned via MCP

### Non-Functional Requirements
- Performance: Build time may increase due to more embedded content; keep under 5s total build
- Security: Standard -- no secrets in skill content
- Compatibility: Existing internal skill override mechanism must still work (internal shadows built-in by name)

## Edge Cases & Error Handling
1. **Reference file not found**: `loadSkillReference('maestro:design', 'nonexistent.md')` returns `{ error: "Reference file 'nonexistent.md' not found in skill 'maestro:design'" }`
2. **Skill name without prefix**: If user runs `maestro skill design`, suggest `maestro:design` in error message
3. **Internal skill with references**: Internal skills on filesystem can also have `reference/` subdirectories; `loadSkillReference` checks filesystem first, then embedded
4. **Empty reference directory**: Skills with no reference files work identically to current flat skills
5. **Nested reference directories**: Reference files can be in subdirectories (e.g., `reference/steps/step-01.md`); path parameter uses forward slashes

## Out of Scope
- Skill packaging/distribution (`.skill` ZIP format) -- deferred to follow-up track
- System-enforced step tracking or validation
- Skill versioning or dependency resolution
- Remote skill fetching or marketplace
- `skills-lock.json` integrity hashing

## Acceptance Criteria
- [ ] `maestro skill maestro:design` loads the merged design skill content
- [ ] `maestro skill maestro:design --ref steps/step-01.md` loads a specific reference file
- [ ] `maestro skill-list` shows all 18 skills with colon-prefixed names, descriptions, and argument hints
- [ ] `loadSkillReference()` works for both built-in (embedded) and internal (filesystem) skills
- [ ] All 4 merged skills contain unique content from both source versions
- [ ] All 6 new reference skills are loadable with their reference files
- [ ] All 8 renamed skills load correctly under new names
- [ ] Internal skill override still shadows built-in skills by name
- [ ] `bun run build` succeeds with all embedded content
- [ ] `bun test` passes (existing + new tests)
- [ ] Agent model configs reference updated skill names
- [ ] MCP `maestro_skill` tool supports reference file loading
