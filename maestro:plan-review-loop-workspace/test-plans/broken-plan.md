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
