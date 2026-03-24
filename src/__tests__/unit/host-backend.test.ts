import { describe, test, expect } from 'bun:test';
import { createHostBackend } from '../../host/factory.ts';
import { ClaudeCodeHostBackend } from '../../host/adapters/claude-code.ts';
import { CodexHostBackend } from '../../host/adapters/codex.ts';

describe('createHostBackend', () => {
  test('returns ClaudeCodeHostBackend for claude-code', () => {
    const backend = createHostBackend('claude-code', '/tmp/project');
    expect(backend).toBeInstanceOf(ClaudeCodeHostBackend);
    expect(backend!.hostType).toBe('claude-code');
  });

  test('returns CodexHostBackend for codex', () => {
    const backend = createHostBackend('codex', '/tmp/project');
    expect(backend).toBeInstanceOf(CodexHostBackend);
    expect(backend!.hostType).toBe('codex');
  });

  test('returns null for standalone', () => {
    expect(createHostBackend('standalone', '/tmp/project')).toBeNull();
  });
});

describe('ClaudeCodeHostBackend (stub)', () => {
  test('createTask returns null', async () => {
    const backend = new ClaudeCodeHostBackend('/tmp/project');
    expect(await backend.createTask('feat', 'task-1', 'Title')).toBeNull();
  });

  test('updateStatus is a no-op', async () => {
    const backend = new ClaudeCodeHostBackend('/tmp/project');
    await backend.updateStatus('feat', 'task-1', 'done');
  });

  test('getMapping returns empty when no file', () => {
    const backend = new ClaudeCodeHostBackend('/tmp/nonexistent-project');
    const mapping = backend.getMapping('feat');
    expect(mapping).toEqual({ tasks: {} });
  });
});

describe('CodexHostBackend (stub)', () => {
  test('createTask returns null', async () => {
    const backend = new CodexHostBackend('/tmp/project');
    expect(await backend.createTask('feat', 'task-1', 'Title')).toBeNull();
  });

  test('updateStatus is a no-op', async () => {
    const backend = new CodexHostBackend('/tmp/project');
    await backend.updateStatus('feat', 'task-1', 'claimed');
  });
});
