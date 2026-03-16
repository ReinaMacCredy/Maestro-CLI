# Webhook Support for Task Completion -- Initial Brainstorm

Good feature idea. Before diving into design, I want to push on a few things and surface decisions that will shape the implementation.

## Questions to Resolve

**1. Scope of triggering events**

You said "when a task completes" -- does that mean only successful completion, or also failure/blocked/cancelled states? My recommendation: fire on any terminal state transition (completed, failed, blocked). A webhook that only fires on success is less useful for CI/CD and monitoring integrations. The `status` field in the payload already communicates what happened.

**2. Retry policy specifics**

Exponential backoff is the right call. A few parameters to nail down:

- **Max retries**: 3 is standard. More than 5 is almost never useful.
- **Base delay**: 1 second? 2 seconds?
- **Jitter**: Add randomized jitter to prevent thundering herd? I'd say yes -- even though maestro is single-user, it's good hygiene and costs nothing.
- **Timeout per attempt**: How long do we wait for a response before considering it failed? 10 seconds seems reasonable.
- **What counts as retriable?** Network errors and 5xx, yes. 4xx, no (those are config problems, retrying won't help). 429 (rate limit) is a maybe -- we could respect `Retry-After` headers.

My default recommendation: 3 retries, 1s base delay with jitter, 10s timeout, retry on network error / 5xx / 429.

**3. Config shape**

You mentioned `.maestro/config.json`. A few design choices:

- Single URL or multiple? If someone wants to notify Slack AND a CI system, do they configure two URLs or is that out of scope?
- Per-feature webhooks or global? A global config is simpler and probably sufficient for v1.
- Authentication: Bearer token in a header? Shared secret for HMAC signing? Or just the raw URL and let them use webhook-specific tokens in the URL itself?

For v1 I'd suggest: single global URL, optional `Authorization` header value, no HMAC signing yet.

```json
{
  "webhook": {
    "url": "https://example.com/hooks/maestro",
    "headers": {
      "Authorization": "Bearer <token>"
    },
    "retries": 3,
    "timeoutMs": 10000
  }
}
```

**4. Payload shape**

You listed task ID, status, duration, and feature name. I'd also consider:

- `taskName` (human-readable, not just the ID)
- `attemptNumber` (which attempt finished, relevant for retried tasks)
- `timestamp` (ISO 8601, when the event occurred)
- `maestroVersion` (for forward compatibility)
- An `event` field like `"task.completed"` so receivers can distinguish event types if we add more later

**5. Fire-and-forget vs. blocking**

Should the webhook fire asynchronously after task completion, or should `task-finish` wait for the webhook to succeed (or exhaust retries) before returning? Fire-and-forget is simpler and doesn't slow down the workflow. But then retry state needs to persist somewhere if the process exits. Blocking is simpler to implement correctly.

My recommendation: blocking but with tight timeouts. The total worst-case delay (3 retries x 10s timeout + backoff) is under a minute, and task completion is not a hot path.

**6. Observability**

When a webhook fails after all retries, what happens? Options:
- Log a warning and continue (silent failure)
- Write to a webhook log file in `.maestro/`
- Print a visible warning to the console

I'd go with: print a warning to stderr and log to `.maestro/webhook.log`. Never block the workflow on webhook failure.

## Implementation Considerations

- Use native `fetch` (available in Bun) -- no new dependencies needed.
- The retry logic is a small utility (~30 lines) that can live in `src/utils/webhook.ts` or similar.
- Hook into the task state machine where status transitions happen, not in the CLI command layer. That way it fires regardless of whether the task was completed via `task-finish`, `task-update`, or any other path.
- Validate the webhook config at startup (is the URL valid? are headers well-formed?) so users get fast feedback on misconfiguration.

## What I'd Push Back On

Nothing major -- this is a clean, well-scoped feature. The one thing I'd challenge: make sure we actually need this before building it. Who is the user? What's the integration target? If it's "notify Slack when a task finishes," there might be a simpler path (e.g., a post-task hook script). But if the goal is structured event delivery to external systems, webhooks are the right abstraction.

---

What are your thoughts on the scope questions above? Once we align on those, this is straightforward to design and implement.
