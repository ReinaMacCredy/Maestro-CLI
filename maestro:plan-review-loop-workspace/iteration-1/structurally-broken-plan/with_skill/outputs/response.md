# Plan Review Loop -- Complete Output

## Review Summary

- **Rounds**: 2
- **Round 1**: VERDICT: FAIL -- 10 issues (2 blocker, 5 major, 2 minor, 1 nit)
- **Round 2**: VERDICT: PASS -- 4 observations (0 blocker, 0 major, 2 minor, 2 nit)
- **Convergence**: Healthy (10 --> 0 actionable). All Round 2 minors/nits also addressed.

---

## Review History

### Round 1: FAIL (10 issues)

| # | Severity | Dimension | Location | Issue | Fix Applied |
|---|----------|-----------|----------|-------|-------------|
| 1 | blocker | DEPENDENCIES | Phase 1, Tasks 1-3 | Circular dependency: Task 1 -> Task 3 -> Task 2 -> Task 1. Deadlock -- no task can start. | Broke the cycle: Task 2 (data model) has no deps except new Task 1 (spike). Task 3 (WebSocket) depends on Task 2. Task 4 (conflict resolution) depends on Tasks 2+3. |
| 2 | blocker | ORDERING | Phase 2, Task 5 | "Implement the UI" is a single task with no dependencies on Phase 1. UI for real-time collab requires WebSocket, presence, and conflict resolution. | Split into 3 scoped tasks (6: editor integration, 7: presence UI, 8: reconnection UI) with explicit Phase 1 dependencies. |
| 3 | major | SCOPE | Task 5 (original) | "Build the entire frontend interface" is unbounded. No acceptance criteria, no component list. | Decomposed into Tasks 6-8 with specific components and acceptance criteria per task. |
| 4 | major | SCOPE | Task 6 (original) | "Optimize all the things" has no target metrics, no baseline, no specific bottlenecks. | Replaced with Task 11: measurement-first approach with specific targets (< 100ms p95 latency, < 5MB per session). Optimize only if targets missed. |
| 5 | major | CLARITY | Task 7 (original) | "Test everything thoroughly" specifies nothing. No test strategy, no coverage targets. | Split into Task 9 (unit tests for CRDT with 90%+ coverage target) and Task 10 (integration tests with 5 concurrent clients). Testing also woven into per-task acceptance criteria. |
| 6 | major | COMPLETENESS | Plan-wide | No mention of auth, transport fallback, reconnection, session lifecycle, or persistence. | Added Discovery section covering all five concerns with explicit decisions. Added SSE fallback to Task 3. Added reconnection handling to Task 8. |
| 7 | major | RISK | Task 2 (original) | CRDTs specified with no justification or alternatives. Library choice has massive implications. | Added Task 1: CRDT library evaluation spike before any implementation. |
| 8 | minor | TESTING | Phase 1 | No per-task verification criteria. | Added acceptance criteria to every task with specific, testable conditions. |
| 9 | minor | COMPLETENESS | Plan-wide | No non-goals section. Scope will creep. | Added Non-Goals section (offline editing, version history, fine-grained permissions, persistence, mobile UI). |
| 10 | nit | CLARITY | Plan-wide | No discovery section. | Added Discovery section with architectural decisions. |

### Round 2: PASS (4 observations, all addressed)

| # | Severity | Dimension | Location | Observation | Fix Applied |
|---|----------|-----------|----------|-------------|-------------|
| 1 | minor | TESTING | Phase 3, Task 9 | Unit tests for CRDT logic depend only on Task 4 but are sequenced in Phase 3. Could run earlier. | Added note that Task 9 can run in parallel with Phase 2 tasks. |
| 2 | minor | RISK | Task 3 | SSE fallback mentioned in description but missing from acceptance criteria. | Added SSE-specific acceptance criteria to Task 3. |
| 3 | nit | CLARITY | Task 6 | Manual test not automatable in CI. | Added automated integration test alongside manual verification. |
| 4 | nit | SCOPE | Task 11 | Performance targets lack justification. | Added rationale for both targets (perceived-instant threshold, 1GB instance viability). |

---

## Improved Plan

# Plan: Add Real-Time Collaboration

## Discovery

This plan adds real-time collaborative editing to the application. Key architectural decisions:

- **CRDT library**: Needs evaluation (Yjs vs Automerge vs custom). A spike task is included before implementation.
- **Transport**: WebSocket as primary, with Server-Sent Events (SSE) fallback for environments where WebSockets are blocked.
- **Session model**: Server-managed sessions with create/join/leave/expire lifecycle. Session state is ephemeral (not persisted beyond session lifetime in v1).
- **Auth**: Sessions are scoped to authenticated users. Authorization checks happen at session-join time. Relies on existing application auth infrastructure.
- **Reconnection**: Clients auto-reconnect with exponential backoff. On reconnect, server sends full state snapshot to resync.

## Non-Goals

- Offline editing support (requires local persistence and sync queue -- future work)
- Version history / undo across sessions
- Fine-grained permissions within a session (e.g., read-only participants)
- Persisting collaborative state beyond session lifetime
- Mobile-specific UI optimizations

## Phase 1: Foundation

### Task 1: CRDT library evaluation spike
Research and evaluate CRDT libraries (Yjs, Automerge, custom). Document tradeoffs: bundle size, memory overhead, supported data types, conflict resolution quality, community support. Produce a decision document with recommendation.
Depends on: none
Acceptance criteria: Decision document exists with at least 2 libraries compared across 4+ criteria. Recommendation is justified.

### Task 2: Create shared data model
Define the shared state data model based on CRDT library choice. Includes: document state shape, cursor/selection state, presence metadata, session metadata.
Depends on: Task 1 (needs CRDT library decision)
Acceptance criteria: TypeScript types/interfaces defined. Data model supports concurrent edits, cursor tracking, and presence. Unit tests validate serialization/deserialization.

### Task 3: Build WebSocket server
Set up WebSocket server with session lifecycle management (create/join/leave/expire). Includes: connection handling, session room management, message broadcasting, graceful disconnection handling, SSE fallback endpoint.
Depends on: Task 2 (needs data model for message shapes)
Acceptance criteria: Server accepts WebSocket connections, assigns clients to sessions, broadcasts state changes to all session participants, handles client disconnection gracefully. SSE fallback endpoint accepts connections and delivers broadcast messages. Integration test with 2+ clients connecting, exchanging messages, and one disconnecting. Separate test verifies SSE fallback receives broadcasts.

### Task 4: Implement conflict resolution
Integrate chosen CRDT library for concurrent edit resolution. Wire CRDT operations through the WebSocket message pipeline. Handle: concurrent edits, cursor position merging, state divergence recovery on reconnect.
Depends on: Task 2 (needs data model), Task 3 (needs WebSocket server)
Acceptance criteria: Two clients can edit the same document concurrently without data loss. Conflict resolution produces deterministic results. Unit tests cover: concurrent inserts at same position, concurrent delete+edit, reconnection state merge.

### Task 5: Add presence indicators
Track and broadcast user presence: who is in the session, cursor positions, active selection ranges. Handle join/leave/disconnect events.
Depends on: Task 3 (needs WebSocket server for broadcasting)
Acceptance criteria: Clients receive presence updates within 500ms of a user joining/leaving/moving cursor. Presence state is cleaned up on disconnect. Integration test with 3+ clients verifying presence updates.

## Phase 2: UI Integration

### Task 6: Editor integration
Integrate CRDT operations with the editor component. Wire local edits to outbound CRDT operations and inbound operations to editor state updates. Handle cursor preservation during remote edits.
Depends on: Task 4 (needs conflict resolution), Task 5 (needs presence)
Acceptance criteria: Local edits propagate to remote clients. Remote edits appear without disrupting local cursor position. Automated integration test: two simulated clients exchange edits and verify state convergence. Manual verification: two browser tabs editing simultaneously to confirm UX.

### Task 7: Presence and connection status UI
Build UI components: active user avatars, remote cursor indicators (colored per user), connection status indicator (connected/reconnecting/disconnected), session join/leave notifications.
Depends on: Task 5 (needs presence data), Task 6 (needs editor integration)
Acceptance criteria: User avatars display for all session participants. Remote cursors are visible and color-coded. Connection status updates on disconnect/reconnect. Components render without layout shift.

### Task 8: Reconnection and error handling UI
Implement client-side reconnection with exponential backoff. Show user-facing status during reconnection. Handle: connection drop, server restart, session expiry. Display actionable error messages.
Depends on: Task 3 (needs WebSocket server), Task 7 (needs connection status UI)
Acceptance criteria: Client auto-reconnects after connection drop. User sees reconnection status. After reconnect, state resyncs via server snapshot. If session expired, user sees clear error with action (e.g., "Session ended. Start a new one.").

## Phase 3: Verification

### Task 9: Unit tests for CRDT logic
Unit tests for conflict resolution edge cases: concurrent inserts at same position, concurrent delete and edit of same range, large document merge performance, malformed operation handling. Note: This task can run in parallel with Phase 2 tasks since it depends only on Task 4, not on UI work.
Depends on: Task 4 (needs conflict resolution implementation)
Acceptance criteria: 90%+ branch coverage on CRDT integration module. All edge cases listed above have dedicated tests.

### Task 10: Integration tests for WebSocket sync
Integration tests for the full sync pipeline: client connects, sends edits, receives remote edits, handles disconnection, reconnects and resyncs. Test with 2-5 simulated concurrent clients.
Depends on: Task 8 (needs full pipeline including reconnection)
Acceptance criteria: Tests run in CI. Simulate 5 concurrent clients with interleaved operations. Assert final state consistency across all clients.

### Task 11: Performance baseline and targets
Measure and document: sync latency (target: < 100ms p95 for 10 concurrent users -- based on Google Docs-class perceived-instant threshold), memory per session (target: < 5MB for 10 users -- keeps server viable on 1GB instances with 200 sessions), WebSocket message throughput. Identify bottlenecks. Optimize only if targets are not met.
Depends on: Task 10 (needs working full pipeline for realistic measurement)
Acceptance criteria: Performance report with measured values against targets. If targets are missed, specific optimization tasks are filed as follow-up.

## Risk Mitigation

- **CRDT complexity**: Mitigated by spike task (Task 1) before committing to implementation
- **WebSocket blocked environments**: SSE fallback endpoint in Task 3
- **Reconnection state divergence**: Full state snapshot on reconnect (Task 3 + Task 8)
- **Performance unknowns**: Deferred to measurement-first approach (Task 11) rather than premature optimization
