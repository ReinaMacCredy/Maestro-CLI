# Plan Review: Add Webhook Notifications

## Issues Found

### 1. No Discovery Section
The plan jumps straight into implementation with no research phase. There is no analysis of:
- Where webhook config fits in the existing config schema
- What events should trigger webhooks (only "task complete" is mentioned -- what about failures, blockers, phase transitions?)
- What payload format to use
- Whether there are existing HTTP/networking utilities in the codebase to reuse

### 2. Tasks Are Severely Underspecified
Every task is 1-2 sentences with zero acceptance criteria. Examples:
- "Add webhook URL to config file" -- which config file? What schema? Is it a single URL or a list? What about auth headers, secrets, timeout settings?
- "POST to the webhook URL with task data" -- what shape is "task data"? What HTTP status codes count as success? What content type?
- "If the webhook fails, retry" -- how many times? What backoff strategy? What counts as failure (timeout? 5xx? network error?)? Should it be blocking or async?
- "Test the webhook feature" -- unit tests? integration tests? What coverage? What scenarios?

### 3. No Error Handling Strategy
The plan mentions retry but says nothing about:
- What happens when all retries are exhausted (dead letter queue? log and continue? alert?)
- Timeout configuration
- Whether webhook failure should block task completion or fire-and-forget
- Credential/secret handling for authenticated endpoints

### 4. No Non-Goals Section
Nothing scopes out what this feature will NOT do. Without non-goals, scope creep is guaranteed.

### 5. No Security Considerations
Webhooks involve outbound HTTP to user-supplied URLs. No mention of:
- SSRF prevention (blocking private IPs, localhost)
- Secret/signing for payload verification (HMAC signatures)
- TLS requirements
- URL validation

### 6. Missing Dependency Analysis
Tasks have no declared dependencies. Task 3 (retry logic) clearly depends on Task 2 (send notifications), but this is not stated. Task 4 depends on all prior tasks.

### 7. No Rollout or Rollback Strategy
No feature flag, no way to disable webhooks without removing config, no consideration of backward compatibility.

---

## Improved Plan

# Plan: Add Webhook Notifications

## Discovery

The maestro CLI needs a webhook notification system so that external tools and dashboards can react to lifecycle events (task completion, failure, blocking). This requires:

1. **Config extension**: Add a `webhooks` section to the maestro config schema supporting one or more endpoint definitions with URL, optional auth header, and retry settings.
2. **Event model**: Define which lifecycle events emit webhook calls. Start with: `task.completed`, `task.failed`, `task.blocked`. Design the event enum to be extensible.
3. **HTTP client**: Determine whether the codebase already has an HTTP client (e.g., `fetch`, `undici`, or a wrapper). Reuse if possible; add no new dependency otherwise.
4. **Payload contract**: Define a versioned JSON payload schema (event type, timestamp, task ID, feature ID, summary, metadata).

## Non-Goals

- Webhook management UI or dashboard
- Inbound webhooks (receiving events from external systems)
- Fan-out to message queues (Kafka, SQS, etc.)
- Per-task webhook configuration (webhooks are feature-level or global)
- Guaranteed exactly-once delivery (best-effort with retries)

## Ghost Diffs

- No changes to task execution logic beyond emitting events at state transitions
- No changes to the CLI argument parser beyond the new config fields
- No changes to existing test fixtures

## Phase 1: Config and Event Model

### Task 1: Extend config schema with webhook settings
**Depends on**: none

Add a `webhooks` section to the config schema:
```
webhooks:
  endpoints:
    - url: "https://example.com/hook"
      secret: "hmac-secret"       # optional, for HMAC-SHA256 signing
      events: ["task.completed", "task.failed"]  # optional filter, default: all
  retry:
    maxAttempts: 3
    backoffMs: 1000               # exponential backoff base
  timeoutMs: 5000
```

**Acceptance criteria**:
- Config parses and validates webhook entries (URL format, positive integers for retry/timeout)
- Invalid config produces actionable error messages
- Missing `webhooks` section is valid (feature is opt-in)
- Unit tests for config parsing: valid config, missing section, invalid URL, invalid retry values

### Task 2: Define webhook event types and payload schema
**Depends on**: none (parallel with Task 1)

Define a `WebhookEvent` type:
```typescript
interface WebhookEvent {
  version: "1";
  event: "task.completed" | "task.failed" | "task.blocked";
  timestamp: string;  // ISO 8601
  feature: { id: string; name: string };
  task: { id: string; title: string; status: string };
  metadata?: Record<string, unknown>;
}
```

**Acceptance criteria**:
- Type is exported and usable by the dispatch module
- Each lifecycle event has a factory function that builds the payload
- Unit tests verify payload shape for each event type

## Phase 2: Dispatch and Delivery

### Task 3: Implement webhook dispatcher with retry and signing
**Depends on**: Task 1, Task 2

Build a `WebhookDispatcher` that:
- Reads endpoints from config
- Filters events against each endpoint's `events` list
- POSTs JSON payload with `Content-Type: application/json`
- Signs payload with HMAC-SHA256 if `secret` is configured (header: `X-Maestro-Signature`)
- Retries on network errors and 5xx responses with exponential backoff
- Logs outcome (success, final failure after retries exhausted) -- never throws, never blocks task completion
- Validates target URL: reject `localhost`, `127.0.0.1`, `::1`, `10.*`, `172.16-31.*`, `192.168.*` (SSRF prevention)

**Acceptance criteria**:
- Successful POST to a mock server delivers correct payload and headers
- HMAC signature is verifiable by the receiver
- Retry fires correct number of times with increasing delays on 500 responses
- After max retries, logs warning and resolves (does not throw)
- Private IP URLs are rejected at config validation time
- Unit tests with mocked HTTP for: success, retry-then-succeed, retry-exhausted, SSRF block, signature verification

### Task 4: Integrate dispatcher into task lifecycle
**Depends on**: Task 3

Wire `WebhookDispatcher.emit()` into the task state machine at:
- `task.completed` -- after status persisted
- `task.failed` -- after status persisted
- `task.blocked` -- after blocker recorded

Webhook dispatch is fire-and-forget (non-blocking). Task status has already been committed before the webhook fires, so webhook failure cannot corrupt state.

**Acceptance criteria**:
- Each lifecycle transition emits the correct event type
- Task completion is not delayed by webhook timeout
- Integration test: complete a task with webhook configured, verify mock server received the event
- Verify no event is emitted when `webhooks` config section is absent

## Phase 3: Testing and Documentation

### Task 5: End-to-end and edge case tests
**Depends on**: Task 4

- E2E test: configure a webhook, run a task through completion, assert the mock server received a valid signed payload
- Edge cases: multiple endpoints with different event filters, endpoint that always fails, endpoint with no secret
- Config edge cases: empty endpoints array, endpoint with no events filter (should receive all)

**Acceptance criteria**:
- All tests pass
- Coverage for dispatcher module exceeds 90% line coverage

### Task 6: Add `--dry-run` flag for webhook testing
**Depends on**: Task 3

Add `maestro webhook-test --dry-run` command that:
- Reads webhook config
- Builds a synthetic `task.completed` event
- POSTs to each configured endpoint (or logs the payload if `--dry-run`)
- Reports success/failure per endpoint

**Acceptance criteria**:
- `--dry-run` outputs the payload without making HTTP requests
- Without `--dry-run`, sends a real test event and reports HTTP status per endpoint
