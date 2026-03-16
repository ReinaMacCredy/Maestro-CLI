# Brainstorming Response: "I want to add caching to the CLI"

---

Caching is a broad space -- maestroCLI touches file I/O, process spawning, skill resolution, plugin loading, and MCP server responses, so "caching" could mean very different things depending on what's actually slow or painful.

Before I jump into approaches, I want to make sure I understand the problem you're solving.

**What problem does this solve?** Which of these is closest to what you're experiencing?

- **Performance/reliability gap** -- certain commands are too slow because they re-read or re-compute things that haven't changed (e.g., scanning skills, loading feature state, re-parsing plans)
- **Developer experience** -- repeated operations feel sluggish during interactive sessions, or there's friction from redundant work across command invocations
- **Missing capability** -- there's no way to persist intermediate results between CLI runs at all, and you need that

Or is it something else entirely? The answer will shape whether we're talking about in-memory caches within a single MCP server session, on-disk caches that persist across CLI invocations, or something more targeted like memoizing specific hot paths.
