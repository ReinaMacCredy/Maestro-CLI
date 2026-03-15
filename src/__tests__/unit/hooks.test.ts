import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  HOOK_EVENTS,
  EVENTS_FILE,
  writeOutput,
  getSessionsDir,
  type HookEventName,
} from '../../hooks/_helpers.ts';

// ---------------------------------------------------------------------------
// _helpers.ts -- HOOK_EVENTS
// ---------------------------------------------------------------------------
describe('HOOK_EVENTS', () => {
  test('contains exactly the four expected event names', () => {
    const expected = ['SessionStart', 'PreToolUse', 'PostToolUse', 'PreCompact'];
    const keys = Object.keys(HOOK_EVENTS);
    expect(keys).toEqual(expected);
  });

  test('values match their keys (identity mapping)', () => {
    for (const [key, value] of Object.entries(HOOK_EVENTS)) {
      expect(value).toBe(key);
    }
  });

  test('is readonly (const assertion)', () => {
    // TypeScript enforces this at compile time, but verify at runtime that
    // the object has the expected shape and no extra keys.
    expect(Object.keys(HOOK_EVENTS).length).toBe(4);
    // Verify each value is a string (not nested or undefined)
    for (const value of Object.values(HOOK_EVENTS)) {
      expect(typeof value).toBe('string');
    }
  });

  test('SessionStart event name is usable as HookEventName type', () => {
    // Runtime check that the value is one of the expected literals.
    const name: HookEventName = HOOK_EVENTS.SessionStart;
    expect(name).toBe('SessionStart');
  });
});

// ---------------------------------------------------------------------------
// _helpers.ts -- EVENTS_FILE
// ---------------------------------------------------------------------------
describe('EVENTS_FILE', () => {
  test('equals "events.jsonl"', () => {
    expect(EVENTS_FILE).toBe('events.jsonl');
  });
});

// ---------------------------------------------------------------------------
// _helpers.ts -- getSessionsDir
// ---------------------------------------------------------------------------
describe('getSessionsDir', () => {
  test('returns <projectDir>/.maestro/sessions', () => {
    const result = getSessionsDir('/some/project');
    expect(result).toBe(path.join('/some/project', '.maestro', 'sessions'));
  });

  test('works with trailing slash in projectDir', () => {
    const result = getSessionsDir('/some/project/');
    // path.join normalizes trailing slashes
    expect(result).toBe(path.join('/some/project', '.maestro', 'sessions'));
  });

  test('handles relative-looking paths consistently', () => {
    const result = getSessionsDir('relative/dir');
    expect(result).toBe(path.join('relative/dir', '.maestro', 'sessions'));
  });
});

// ---------------------------------------------------------------------------
// _helpers.ts -- writeOutput
// ---------------------------------------------------------------------------
describe('writeOutput', () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('writes JSON-serialized object to console.log', () => {
    const data = { foo: 'bar', num: 42 };
    writeOutput(data);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data));
  });

  test('outputs valid JSON', () => {
    const data = { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 'test' } };
    writeOutput(data);
    const output = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual(data);
  });

  test('handles empty object', () => {
    writeOutput({});
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toBe('{}');
  });

  test('handles nested objects', () => {
    const nested = { a: { b: { c: [1, 2, 3] } } };
    writeOutput(nested);
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toEqual(nested);
  });
});

// ---------------------------------------------------------------------------
// pretooluse.ts (tested via subprocess)
// ---------------------------------------------------------------------------
describe('pretooluse hook (via subprocess)', () => {
  let tmpDir: string;
  const pretoolPath = path.resolve(
    import.meta.dir,
    '../../hooks/pretooluse.ts',
  );

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-hooks-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Run pretooluse.ts as a subprocess with the given stdin JSON and cwd. */
  async function runPretool(
    input: Record<string, unknown>,
    cwd: string,
  ): Promise<string> {
    const proc = Bun.spawn(['bun', 'run', pretoolPath], {
      cwd,
      stdin: new Blob([JSON.stringify(input)]),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    return stdout.trim();
  }

  test('git commit in maestro project emits task-finish advisory', async () => {
    fs.mkdirSync(path.join(tmpDir, '.maestro'), { recursive: true });

    const output = await runPretool(
      { tool_name: 'Bash', tool_input: { command: 'git commit -m "test"' } },
      tmpDir,
    );

    expect(output).not.toBe('');
    const parsed = JSON.parse(output);
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toContain(
      'maestro_task_finish',
    );
  });

  test('git commit outside maestro project emits no output', async () => {
    const output = await runPretool(
      { tool_name: 'Bash', tool_input: { command: 'git commit -m "test"' } },
      tmpDir,
    );

    expect(output).toBe('');
  });

  test('git push emits no output', async () => {
    fs.mkdirSync(path.join(tmpDir, '.maestro'), { recursive: true });
    const output = await runPretool(
      { tool_name: 'Bash', tool_input: { command: 'git push origin main' } },
      tmpDir,
    );
    expect(output).toBe('');
  });

  test('git merge emits no output', async () => {
    fs.mkdirSync(path.join(tmpDir, '.maestro'), { recursive: true });
    const output = await runPretool(
      { tool_name: 'Bash', tool_input: { command: 'git merge some-branch' } },
      tmpDir,
    );
    expect(output).toBe('');
  });

  test('non-Bash tool emits no output', async () => {
    const output = await runPretool(
      { tool_name: 'Read', tool_input: { path: '/some/file' } },
      tmpDir,
    );

    expect(output).toBe('');
  });

  test('non-git Bash command emits no output', async () => {
    const output = await runPretool(
      { tool_name: 'Bash', tool_input: { command: 'ls -la' } },
      tmpDir,
    );

    expect(output).toBe('');
  });
});
