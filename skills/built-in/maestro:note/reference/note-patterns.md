# Note Patterns

Concrete examples of good and bad notes for common scenarios. Each good note follows the format:
`[{date}] [{feature-name}:{task}] {insight with reasoning}`

## Decisions

<Good>
```
maestro memory-write --key jwt-decision "[2026-03-15] [auth-refactor:task-3] Chose JWT over session cookies -- stateless scales better for multi-region deploy, avoids shared session store"
```
Specific choice, names alternatives, includes the "why."
</Good>

<Bad>
```
maestro memory-write --key auth "decided on JWT"
```
No date, no feature, no reasoning. A future session cannot evaluate whether this still applies.
</Bad>

## Constraints

<Good>
```
maestro memory-write --key stripe-rate-limit "[2026-03-15] [payments:task-1] Stripe API rate limit is 100/sec in test mode; batch operations must throttle with 10ms delay between calls"
```
Quantified constraint with actionable mitigation.
</Good>

<Bad>
```
maestro memory-write --key stripe "Stripe has rate limits"
```
Every API has rate limits. This tells a future session nothing about what to do differently.
</Bad>

## Discoveries

<Good>
```
maestro memory-write --key pg-notify-limit "[2026-03-15] [migration:task-2] Postgres NOTIFY payload max is 8000 bytes; large events must use polling fallback via pg_notify_overflow table"
```
Exact limit, exact workaround, exact mechanism.
</Good>

<Bad>
```
maestro memory-write --key postgres "found a postgres limitation"
```
Which limitation? What was the workaround? Useless to a future session.
</Bad>

## Blocked-by-User-Input

<Good>
```
maestro memory-write --key region-choice "[2026-03-15] [deploy:task-4] User chose us-east-1 over eu-west-1 for primary region; latency tradeoff accepted for cost savings (~40% less)"
```
Records the decision, the tradeoff, and the reasoning so no one re-asks.
</Good>

<Bad>
```
maestro memory-write --key region "user picked a region"
```
Which region? Why? A future session will ask the user again.
</Bad>

## Cross-Feature Dependencies

<Good>
```
maestro memory-write --key auth-dependency "[2026-03-15] [api-v2:task-1] Depends on auth-refactor feature completing JWT middleware (task-2) before API routes can use auth guards"
```
Names both features, the specific dependency, and the blocking task.
</Good>

<Bad>
```
maestro memory-write --key dep "need auth first"
```
Which auth? Which feature? Which task? Unresolvable without asking.
</Bad>

## Global Memory Examples

Global memory entries are injected into every session and every worker. They must be hard constraints that affect all work.

<Good>
```
maestro memory-write --global --key api-envelope "All new endpoints MUST use the v2 response envelope ({ data, meta, errors })"
maestro memory-write --global --key no-legacy-imports "Do NOT import from @legacy/* -- migration in progress, use @core/* equivalents"
maestro memory-write --global --key pg14-only "PostgreSQL 14 only -- no PG15 features (project constraint until Q3)"
maestro memory-write --global --key test-db-isolation "Test database is shared; always use transaction rollback, never truncate"
```
Each is a constraint that, if violated, creates wrong code. Workers cannot ask -- they need this upfront.
</Good>

<Bad>
```
maestro memory-write --global --key testing "Remember to test things"
maestro memory-write --global --key lang "We're using TypeScript"
maestro memory-write --global --key blocked "Task 3 is blocked"
maestro memory-write --global --key size "The codebase is large"
```
"Remember to test" is not a constraint. "We're using TypeScript" is obvious from file extensions. "Task 3 is blocked" is status (use `maestro_task_block`). "The codebase is large" is not actionable.
</Bad>

## Promoting Feature Memory to Global

When a feature-scoped insight proves valuable across multiple features, promote it:

```
maestro memory-promote --key <key-name>
```

This copies the entry from the active feature's memory to global memory. Use this when:
- A constraint discovered in one feature applies project-wide
- A workaround is needed by multiple features
- A coding convention emerged that should be enforced everywhere
