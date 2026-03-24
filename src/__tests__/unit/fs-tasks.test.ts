import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { FsTaskAdapter } from '../../tasks/adapter.ts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FsTaskAdapter', () => {
  let tmpDir: string;
  let adapter: FsTaskAdapter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-fs-tasks-'));
    // Create minimal feature structure
    const featureDir = path.join(tmpDir, '.maestro', 'features', 'test-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    adapter = new FsTaskAdapter(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('create/get round-trip', async () => {
    const task = await adapter.create('test-feat', 'Setup Auth');
    expect(task.folder).toBe('01-setup-auth');
    expect(task.name).toBe('setup-auth');
    expect(task.status).toBe('pending');
    expect(task.origin).toBe('plan');

    const fetched = await adapter.get('test-feat', '01-setup-auth');
    expect(fetched).not.toBeNull();
    expect(fetched!.folder).toBe('01-setup-auth');
    expect(fetched!.status).toBe('pending');
  });

  test('create auto-increments order', async () => {
    const t1 = await adapter.create('test-feat', 'First');
    const t2 = await adapter.create('test-feat', 'Second');
    expect(t1.folder).toBe('01-first');
    expect(t2.folder).toBe('02-second');
  });

  test('create with deps stores dependsOn', async () => {
    const t1 = await adapter.create('test-feat', 'First');
    const t2 = await adapter.create('test-feat', 'Second', { deps: [t1.folder] });
    expect(t2.dependsOn).toEqual([t1.folder]);
  });

  test('create with description writes spec', async () => {
    await adapter.create('test-feat', 'Task A', { description: '# Spec content' });
    const spec = await adapter.readSpec('test-feat', '01-task-a');
    expect(spec).toBe('# Spec content');
  });

  test('list returns pending tasks by default', async () => {
    await adapter.create('test-feat', 'Task A');
    await adapter.create('test-feat', 'Task B');
    const tasks = await adapter.list('test-feat');
    expect(tasks).toHaveLength(2);
  });

  test('list with includeAll returns done tasks', async () => {
    const t = await adapter.create('test-feat', 'Task A');
    // Manually write done status
    const statusPath = path.join(tmpDir, '.maestro', 'features', 'test-feat', 'tasks', t.folder, 'status.json');
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    status.status = 'done';
    fs.writeFileSync(statusPath, JSON.stringify(status));

    const withoutAll = await adapter.list('test-feat');
    expect(withoutAll).toHaveLength(0);

    const withAll = await adapter.list('test-feat', { includeAll: true });
    expect(withAll).toHaveLength(1);
    expect(withAll[0].status).toBe('done');
  });

  test('list with status filter', async () => {
    await adapter.create('test-feat', 'Task A');
    await adapter.create('test-feat', 'Task B');
    // Set task B to blocked
    const statusPath = path.join(tmpDir, '.maestro', 'features', 'test-feat', 'tasks', '02-task-b', 'status.json');
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    status.status = 'blocked';
    fs.writeFileSync(statusPath, JSON.stringify(status));

    const blocked = await adapter.list('test-feat', { status: 'blocked' });
    expect(blocked).toHaveLength(1);
    expect(blocked[0].folder).toBe('02-task-b');
  });

  test('remove deletes task directory', async () => {
    const t = await adapter.create('test-feat', 'Doomed');
    await adapter.remove('test-feat', t.folder);
    const fetched = await adapter.get('test-feat', t.folder);
    expect(fetched).toBeNull();
  });

  test('getRunnable respects dependencies', async () => {
    const t1 = await adapter.create('test-feat', 'First');
    await adapter.create('test-feat', 'Second', { deps: [t1.folder] });

    const runnable = await adapter.getRunnable('test-feat');
    expect(runnable).toHaveLength(1);
    expect(runnable[0].folder).toBe('01-first');
  });

  test('getRunnable unblocks after dependency done', async () => {
    const t1 = await adapter.create('test-feat', 'First');
    await adapter.create('test-feat', 'Second', { deps: [t1.folder] });

    // Mark t1 as done
    const statusPath = path.join(tmpDir, '.maestro', 'features', 'test-feat', 'tasks', t1.folder, 'status.json');
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    status.status = 'done';
    fs.writeFileSync(statusPath, JSON.stringify(status));

    const runnable = await adapter.getRunnable('test-feat');
    expect(runnable).toHaveLength(1);
    expect(runnable[0].folder).toBe('02-second');
  });

  test('spec read/write round-trip', async () => {
    const t = await adapter.create('test-feat', 'Task A');
    await adapter.writeSpec('test-feat', t.folder, '# My Spec');
    const spec = await adapter.readSpec('test-feat', t.folder);
    expect(spec).toBe('# My Spec');
  });

  test('report read/write round-trip', async () => {
    const t = await adapter.create('test-feat', 'Task A');
    await adapter.writeReport('test-feat', t.folder, '# Report');
    const report = await adapter.readReport('test-feat', t.folder);
    expect(report).toBe('# Report');
  });

  test('get returns null for nonexistent task', async () => {
    const result = await adapter.get('test-feat', 'nonexistent');
    expect(result).toBeNull();
  });

  test('list returns empty for nonexistent feature', async () => {
    const result = await adapter.list('no-such-feature');
    expect(result).toEqual([]);
  });
});
