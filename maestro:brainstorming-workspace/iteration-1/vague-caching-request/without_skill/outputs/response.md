# Brainstorming Response: "I want to add caching to the CLI"

Caching is a broad space -- let me ask a few questions to narrow down what would be most valuable here.

## What layer are you thinking about caching?

1. **Filesystem reads** -- maestro does a lot of reading from `.maestro/` (plans, tasks, context files, session data). Are you seeing latency from repeated reads of the same files within a single command or session?

2. **Computed state** -- things like `status` that aggregate data from multiple files (feature state, task states, dependency resolution). The result could be cached and invalidated when underlying files change.

3. **Command registry / skill discovery** -- the CLI does skill listing, command registration. If those are doing filesystem scans on every invocation, caching the results could speed up startup.

4. **Cross-invocation persistence** -- caching results between separate `maestro` CLI calls (e.g., a `.maestro/.cache/` directory), vs. in-memory caching within a single command's execution.

## A few things I'd want to understand

- **What's slow right now?** Is there a specific command or workflow where you're feeling the latency? `status` hitting many files? `task-sync` recomputing from the plan? Skill loading?

- **How stale is acceptable?** Some caches can be aggressive (skill list rarely changes mid-session), others need tight invalidation (task status changes frequently during orchestration).

- **Single-process or multi-agent?** When multiple workers are running in parallel worktrees, cache coherence gets interesting. A worker finishing a task changes state that the orchestrator's cache might hold stale.

## Initial directions I see

- **File-content cache with mtime invalidation**: Read file, store content keyed by path+mtime. Cheap, correct, no stale data risk. Good for repeated reads within a command.

- **Computed-state cache**: Cache the output of expensive aggregations (like `status`) with a manifest of input file mtimes. Invalidate when any input changes.

- **Registry cache**: Generate and cache command/skill registries at build time or first-run, with a version stamp. Already partially happening with `registry.generated.ts` -- could extend this pattern.

Which of these resonates? Or is there a different angle you had in mind -- maybe caching external API responses, or something at the hive-core layer?
