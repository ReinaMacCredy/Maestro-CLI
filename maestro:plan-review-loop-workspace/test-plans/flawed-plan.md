# Plan: Add Webhook Notifications

## Summary

Add optional webhook notifications so that external systems can be notified when tasks complete. A single webhook URL is configured; the system POSTs a JSON payload on task completion events. Delivery is best-effort with retries.

## Non-Goals

- Multiple webhook URLs / fan-out
- Webhook management UI
- Event filtering (subscribe to specific event types)
- Guaranteed exactly-once delivery
- Custom payload templates

## Phase 0: Design

### Task 0.1: Define webhook config schema
**Depends on:** none
**Files:** `src/config/schema.ts`, `src/config/defaults.ts`
**Acceptance criteria:**
- Add `webhook` section to config schema: `{ url?: string, enabled: boolean, timeoutMs: number, maxRetries: number, signingSecret?: string }`
- `enabled` defaults to `false`, `timeoutMs` defaults to `5000`, `maxRetries` defaults to `3`
- Validate URL format when provided (must be `https://` or `http://localhost` for dev)
- Webhook URL must be treated as a secret -- never logged in full, masked in status output

### Task 0.2: Define webhook payload contract
**Depends on:** none
**Acceptance criteria:**
- Document the JSON payload shape:
  ```json
  {
    "event": "task.completed",
    "timestamp": "ISO-8601",
    "task": {
      "id": "string",
      "name": "string",
      "status": "completed | failed",
      "duration_ms": "number"
    },
    "feature": {
      "id": "string",
      "name": "string"
    }
  }
  ```
- Define HTTP headers: `Content-Type: application/json`, `X-Webhook-Event: task.completed`, `X-Webhook-Signature: HMAC-SHA256` (if signing secret configured)

## Phase 1: Implementation

### Task 1.1: Implement webhook config loading
**Depends on:** Task 0.1
**Files:** `src/config/schema.ts`, `src/config/loader.ts`
**Acceptance criteria:**
- Read webhook config from the project config file
- Validate URL format; reject invalid URLs with actionable error message
- Mask webhook URL in any log output (show only last 4 chars)
- Unit test: valid config loads; invalid URL rejected; missing config means disabled

### Task 1.2: Implement webhook sender
**Depends on:** Task 0.1, Task 0.2
**Files:** `src/webhooks/sender.ts`
**Acceptance criteria:**
- `sendWebhook(payload: WebhookPayload): Promise<WebhookResult>` function
- Use the project's existing HTTP client (or `fetch` if none exists)
- Set `Content-Type: application/json` header
- Respect `timeoutMs` from config; abort request on timeout
- Return `{ success: boolean, statusCode?: number, error?: string, attempt: number }`
- Do NOT throw on failure -- return error result
- Unit test: mock HTTP, verify correct URL/headers/body; verify timeout handling

### Task 1.3: Implement retry logic with exponential backoff
**Depends on:** Task 1.2
**Files:** `src/webhooks/retry.ts`
**Acceptance criteria:**
- Retry on: network errors, HTTP 5xx, HTTP 429 (respect `Retry-After` header if present)
- Do NOT retry on: HTTP 4xx (except 429), successful responses
- Exponential backoff: 1s, 2s, 4s (base * 2^attempt), capped at `maxRetries` from config
- Add jitter (0-500ms random) to prevent thundering herd
- Log each retry attempt at `warn` level (with masked URL)
- After final retry failure, log at `error` level and continue (do not crash the process)
- Unit test: verify retry count, backoff timing, non-retryable status codes skip retry

### Task 1.4: Integrate webhook into task completion flow
**Depends on:** Task 1.1, Task 1.3
**Files:** Locate the task state-transition handler (search for `status` assignment to `completed` or `failed` in `src/tasks/` or `src/commands/task/`). The integration point is wherever `task.status` is set to a terminal state.
**Acceptance criteria:**
- After a task transitions to `completed` or `failed`, fire webhook if enabled in config
- Webhook delivery is fire-and-forget -- must NOT block task completion
- If webhook delivery fails after all retries, log error but do not affect task status
- Integration test: mock HTTP server, complete a task, verify webhook received

## Phase 2: Testing and Hardening

### Task 2.1: Integration tests for webhook delivery
**Depends on:** Task 1.4
**Acceptance criteria:**
- Test with a local mock HTTP server (not real endpoints)
- Verify: correct payload shape, correct headers, retry on 5xx, no retry on 4xx
- Verify: disabled webhook sends nothing
- Verify: invalid URL in config is rejected at load time
- Verify: webhook failure does not block or fail task completion

### Task 2.2: Manual verification and edge cases
**Depends on:** Task 2.1
**Acceptance criteria:**
- Test with webhook.site or similar to verify real HTTP delivery
- Test edge cases: very slow endpoint (verify timeout works), endpoint that always 500s (verify retries exhaust and process continues), empty/missing config (verify graceful no-op)

### Task 2.3: Add webhook configuration documentation
**Depends on:** Task 1.1
**Acceptance criteria:**
- Document in the project README or config reference: how to enable webhooks, config fields and defaults, payload format, security (signing secret)
- Include a minimal example config snippet

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Webhook endpoint is slow/down | Timeout config (default 5s), fire-and-forget, never blocks task flow |
| Webhook URL contains secrets | Mask in logs, treat as sensitive config |
| Retry storms under load | Exponential backoff with jitter, cap at maxRetries |
| Breaking existing task flow | Webhook is opt-in (disabled by default), failure is non-fatal |

## Rollback Strategy

Webhook is disabled by default via `enabled: false`. If issues arise in production, set `enabled: false` in config to immediately disable without code changes.
