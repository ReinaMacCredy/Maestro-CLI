/**
 * Tests for Agent Mail handoff routing and receiveHandoffs inbox integration.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { AgentMailHandoffAdapter } from '../../adapters/agent-mail-handoff.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { InMemoryMemoryPort } from '../mocks/in-memory-memory-port.ts';
import type { FsConfigAdapter } from '../../adapters/fs/config.ts';
import type { HiveConfig } from '../../core/types.ts';
import { DEFAULT_HIVE_CONFIG } from '../../core/types.ts';
import type { HandoffDocument } from '../../handoff/port.ts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FEATURE = 'test-handoff-routing';

function makeConfigAdapter(overrides?: Partial<HiveConfig>): FsConfigAdapter {
  const config: HiveConfig = { ...DEFAULT_HIVE_CONFIG, ...overrides };
  return {
    get: () => config,
    getPath: () => '/mock/config.json',
  } as unknown as FsConfigAdapter;
}

function makeHandoff(beadId: string): HandoffDocument {
  return {
    beadId,
    beadState: { title: 'Test Task', status: 'claimed' },
    decisions: [],
    modifiedFiles: [],
    blockers: [],
    openQuestions: [],
    nextSteps: [],
    criticalContext: 'Some context',
    cassPointer: `Search prior sessions: maestro search-sessions --query "test"`,
  };
}

// ---------------------------------------------------------------------------
// sendHandoff routing tests (Phase 2)
// ---------------------------------------------------------------------------

describe('sendHandoff routing', () => {
  let taskPort: InMemoryTaskPort;
  let memoryPort: InMemoryMemoryPort;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-handoff-'));
    const featureDir = path.join(tmpDir, '.maestro', 'features', FEATURE, 'handoffs');
    fs.mkdirSync(featureDir, { recursive: true });
    taskPort = new InMemoryTaskPort();
    memoryPort = new InMemoryMemoryPort();
  });

  test('sendHandoff writes local file even when Agent Mail unreachable', async () => {
    const adapter = new AgentMailHandoffAdapter(
      tmpDir, taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );
    const handoff = makeHandoff('task-01');
    const result = await adapter.sendHandoff(FEATURE, handoff);

    expect(result.filePath).toContain('task-01');
    expect(result.agentMailSent).toBe(false);
    // Local file should exist
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  test('handoff doc uses maestro commands, not br/cass', async () => {
    const adapter = new AgentMailHandoffAdapter(
      tmpDir, taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );
    const handoff = makeHandoff('task-02');
    const result = await adapter.sendHandoff(FEATURE, handoff);
    const content = fs.readFileSync(result.filePath, 'utf-8');

    // Should NOT reference br or cass
    expect(content).not.toContain('br show');
    expect(content).not.toContain('cass search');
    // Should reference maestro commands
    expect(content).toContain('maestro task-info');
    expect(content).toContain('maestro search-sessions');
  });

  test('handoff doc uses br commands when taskBackend is br', async () => {
    const adapter = new AgentMailHandoffAdapter(
      tmpDir, taskPort, memoryPort,
      makeConfigAdapter({ taskBackend: 'br' }),
      'http://unreachable:9999',
    );
    const handoff = makeHandoff('task-03');
    const result = await adapter.sendHandoff(FEATURE, handoff);
    const content = fs.readFileSync(result.filePath, 'utf-8');

    expect(content).toContain('br show task-03 --json');
  });

  test('handoff doc says "Task:" not "Bead:"', async () => {
    const adapter = new AgentMailHandoffAdapter(
      tmpDir, taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );
    const handoff = makeHandoff('task-04');
    const result = await adapter.sendHandoff(FEATURE, handoff);
    const content = fs.readFileSync(result.filePath, 'utf-8');

    expect(content).toContain('Task: `task-04`');
    expect(content).not.toContain('Bead: `task-04`');
  });
});

// ---------------------------------------------------------------------------
// receiveHandoffs tests (Phase 3)
// ---------------------------------------------------------------------------

describe('receiveHandoffs', () => {
  let taskPort: InMemoryTaskPort;
  let memoryPort: InMemoryMemoryPort;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-receive-'));
    taskPort = new InMemoryTaskPort();
    memoryPort = new InMemoryMemoryPort();
  });

  test('returns local files when Agent Mail unavailable', async () => {
    // Write a local handoff file
    const handoffsDir = path.join(tmpDir, '.maestro', 'features', FEATURE, 'handoffs');
    fs.mkdirSync(handoffsDir, { recursive: true });
    fs.writeFileSync(path.join(handoffsDir, 'task-01.md'), '## Handoff: 2025-01-01 00:00:00\n\nContent');

    const adapter = new AgentMailHandoffAdapter(
      tmpDir, taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );

    const handoffs = await adapter.receiveHandoffs(FEATURE, 'codex');
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0].beadId).toBe('task-01');
    expect(handoffs[0].criticalContext).toContain('Handoff:');
  });

  test('returns empty for no feature', async () => {
    const adapter = new AgentMailHandoffAdapter(
      tmpDir, taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );

    const handoffs = await adapter.receiveHandoffs(undefined, 'codex');
    expect(handoffs).toEqual([]);
  });

  test('returns empty when no handoffs dir and Agent Mail unreachable', async () => {
    const adapter = new AgentMailHandoffAdapter(
      tmpDir, taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );

    const handoffs = await adapter.receiveHandoffs(FEATURE, 'codex');
    expect(handoffs).toEqual([]);
  });

  test('returns local files when no agentId provided (no Agent Mail query)', async () => {
    const handoffsDir = path.join(tmpDir, '.maestro', 'features', FEATURE, 'handoffs');
    fs.mkdirSync(handoffsDir, { recursive: true });
    fs.writeFileSync(path.join(handoffsDir, 'local-only.md'), '## Handoff: 2025-01-01\n\nLocal content');

    const adapter = new AgentMailHandoffAdapter(
      tmpDir, taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );

    // No agentId => only local files, no Agent Mail fetch
    const handoffs = await adapter.receiveHandoffs(FEATURE);
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0].beadId).toBe('local-only');
  });
});
