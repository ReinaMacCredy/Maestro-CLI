import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdin, resolveProjectDir, logHookError } from './_helpers.ts';

const HOOK_NAME = 'posttooluse';

async function main(): Promise<void> {
  const input = await readStdin();
  const projectDir = resolveProjectDir();
  if (!projectDir) return;

  const toolName = (input.tool_name as string) || 'unknown';

  const sessionsDir = path.join(projectDir, '.maestro', 'sessions');
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  const eventsPath = path.join(sessionsDir, 'events.jsonl');
  const entry = JSON.stringify({ ts: new Date().toISOString(), tool: toolName }) + '\n';
  fs.appendFileSync(eventsPath, entry, { flag: 'a' });

  // Pure side effect -- no stdout output
}

try {
  await main();
} catch (error) {
  logHookError(resolveProjectDir(), HOOK_NAME, error);
  // No output on error
}
