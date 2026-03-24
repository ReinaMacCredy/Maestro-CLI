import { describe, test, expect, afterEach } from 'bun:test';
import { readHostMapping, writeHostMapping } from '../../host/mapping.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpDir: string;

function setup(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-mapping-'));
  return tmpDir;
}

afterEach(() => {
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ }
  }
});

describe('readHostMapping', () => {
  test('returns empty mapping when file does not exist', () => {
    const dir = setup();
    const mapping = readHostMapping(dir);
    expect(mapping).toEqual({ tasks: {} });
  });

  test('reads existing mapping', () => {
    const dir = setup();
    const data = { tasks: { 'setup-auth': 'host-123' }, reconciledAt: '2026-01-01' };
    fs.writeFileSync(path.join(dir, 'host-mapping.json'), JSON.stringify(data));

    const mapping = readHostMapping(dir);
    expect(mapping.tasks).toEqual({ 'setup-auth': 'host-123' });
    expect(mapping.reconciledAt).toBe('2026-01-01');
  });
});

describe('writeHostMapping', () => {
  test('writes mapping file', () => {
    const dir = setup();
    const data = { tasks: { 'auth': 'h1', 'api': 'h2' } };
    writeHostMapping(dir, data);

    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'host-mapping.json'), 'utf-8'));
    expect(raw.tasks).toEqual({ 'auth': 'h1', 'api': 'h2' });
  });

  test('round-trips with readHostMapping', () => {
    const dir = setup();
    const data = { tasks: { 'task-1': 'host-a' }, reconciledAt: '2026-03-24T12:00:00Z' };
    writeHostMapping(dir, data);

    const read = readHostMapping(dir);
    expect(read).toEqual(data);
  });
});
