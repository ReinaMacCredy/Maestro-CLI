# Plan Review: Add Real-Time Collaboration

## Issues Found

### [!] Critical: Circular dependency chain (Tasks 1-2-3)

- Task 1 depends on Task 3
- Task 3 depends on Task 2
- Task 2 depends on Task 1 AND Task 3

This is a deadlock. No task can begin execution. The root cause is that the data model (Task 3) was given a false dependency on conflict resolution (Task 2). In practice, the data model is foundational -- it must come first. Conflict resolution builds on the data model, and the WebSocket server transports it.

**Fix**: Reorder so Task 3 (data model) has no dependencies, Task 1 (WebSocket) depends on Task 3, and Task 2 (CRDTs) depends on both Task 1 and Task 3.

### [!] Missing required plan sections

The plan is missing three required sections:
- `## Discovery` -- required by project conventions, minimum 100 characters. Must document research findings and codebase exploration results.
- `## Non-Goals` -- required. Must explicitly scope out what this feature will NOT do.
- `## Ghost Diffs` -- required. Must identify files/areas that will be touched but are not the focus.

### [!] Vague, unbounded tasks (Tasks 5-7)

- **Task 5** ("Build the entire frontend interface") -- this is a mega-task, not a task. It needs decomposition into concrete pieces (e.g., cursor overlay component, presence sidebar, edit highlight rendering).
- **Task 6** ("Make everything fast. Optimize all the things.") -- no measurable acceptance criteria. What latency target? What throughput? Which operations?
- **Task 7** ("Test everything thoroughly") -- no scope. Testing should be per-task, not a monolithic afterthought.

### [!] Phase 2 tasks have no dependency declarations

Tasks 5-7 clearly depend on Phase 1 infrastructure but declare no dependencies. Task 5 (UI) needs the WebSocket server and data model at minimum. Task 6 (performance) needs a working system to optimize.

### [!] No acceptance criteria on any task

None of the seven tasks define what "done" looks like. Every task should have concrete, verifiable acceptance criteria.

---

## Improved Plan

# Plan: Add Real-Time Collaboration

## Discovery

The feature adds real-time multi-user collaboration to the editor. Users should see each other's cursors, edits should sync without conflicts, and the system should handle concurrent modifications gracefully. Initial research indicates CRDT-based conflict resolution (e.g., Yjs or Automerge) is the standard approach for this class of problem. The existing codebase uses a REST API for persistence; WebSocket will be added alongside it for real-time transport.

## Non-Goals

- Offline-first / local-first editing (sync requires active connection)
- Voice or video communication between collaborators
- Permission-based editing restrictions (all collaborators have equal edit access)
- Version history / undo across users (only local undo is in scope)

## Ghost Diffs

- API server startup code (adding WebSocket upgrade handling alongside existing HTTP)
- Client-side state management (integrating shared state with existing local state)
- Build configuration (adding CRDT library dependency)

## Phase 1: Infrastructure

### Task 1: Define shared data model
Design and implement the shared state data model that represents a collaborative document.
Dependencies: none
Acceptance criteria:
- Data model types are defined and exported
- Serialization/deserialization round-trips without data loss
- Unit tests cover model creation, serialization, and edge cases (empty doc, max-size fields)

### Task 2: Build WebSocket server
Set up a WebSocket server that handles client connections and broadcasts state changes.
Dependencies: Task 1 (needs the data model for message payloads)
Acceptance criteria:
- Server accepts WebSocket connections on a dedicated endpoint
- Clients can connect, send, and receive messages
- Connection lifecycle is handled (connect, disconnect, reconnect)
- Integration test confirms two clients can exchange messages

### Task 3: Implement CRDT-based conflict resolution
Integrate a CRDT library to handle concurrent edits without conflicts.
Dependencies: Task 1 (needs the data model), Task 2 (needs WebSocket transport)
Acceptance criteria:
- Concurrent edits from two clients converge to the same state
- No data loss under concurrent modification
- Unit tests cover: concurrent inserts, concurrent deletes, insert-delete conflicts

### Task 4: Add presence indicators
Show which users are connected and what they are currently editing.
Dependencies: Task 2 (needs WebSocket for presence broadcast)
Acceptance criteria:
- Connected users see a list of other active collaborators
- Cursor positions of other users are broadcast and displayed
- Users disappear from presence list within 5 seconds of disconnecting

## Phase 2: UI and Integration

### Task 5: Build cursor overlay component
Render remote users' cursors and selections in the editor viewport.
Dependencies: Task 3 (needs conflict-resolved state), Task 4 (needs presence data)
Acceptance criteria:
- Remote cursors render with distinct colors per user
- Cursor positions update in real-time as remote users type
- Selections (highlighted ranges) are shown for remote users

### Task 6: Build collaboration sidebar
Show active collaborators, their status, and provide session controls.
Dependencies: Task 4 (needs presence data)
Acceptance criteria:
- Sidebar lists all connected users with name/avatar
- Active editing location is shown per user (file, line)
- User can leave the collaboration session from the sidebar

### Task 7: Optimize WebSocket message throughput
Reduce message size and frequency to keep latency under target for typical usage.
Dependencies: Task 2, Task 3 (needs working WebSocket + CRDT pipeline to measure)
Acceptance criteria:
- Keystroke-to-render latency is under 100ms on LAN (p95)
- Message batching reduces WebSocket frame count by at least 50% compared to naive per-keystroke sending
- Load test: 10 concurrent users editing the same document without degradation
