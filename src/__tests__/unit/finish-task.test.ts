import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { finishTask } from '../../usecases/finish-task.ts';

describe('finishTask', () => {
  let tmpDir: string;
  let taskPort: InMemoryTaskPort;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-finish-task-'));
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features'), { recursive: true });
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), 'hello\n');
    execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "init"', { cwd: tmpDir, stdio: 'ignore' });

    taskPort = new InMemoryTaskPort();
    taskPort.seed('feat', '01-task', { status: 'in_progress' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes summary and audit data, then closes completed task', async () => {
    const baseCommit = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();
      await taskPort.update('feat', '01-task', {
        baseCommit,
        startedAt: new Date().toISOString(),
      });
      fs.writeFileSync(path.join(tmpDir, 'README.md'), 'changed\n');
      fs.writeFileSync(path.join(tmpDir, 'NEW.md'), 'new file\n');

    const result = await finishTask(
      { taskPort, directory: tmpDir },
      {
        feature: 'feat',
        task: '01-task',
        status: 'completed',
        summary: 'Updated README and left the working tree dirty on purpose.',
      },
    );

    const task = await taskPort.get('feat', '01-task');
    const report = await taskPort.readReport('feat', '01-task');

    expect(result.status).toBe('done');
    expect(task?.status).toBe('done');
    expect(task?.summary).toBe('Updated README and left the working tree dirty on purpose.');
      expect(report).toContain('## Git Audit');
      expect(report).toContain('Dirty working tree: yes');
      expect(report).toContain('README.md');
      expect(report).toContain('NEW.md');
    });
  });
