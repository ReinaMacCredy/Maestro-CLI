import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdin, resolveProjectDir, logHookError, getSessionsDir, EVENTS_FILE } from './_helpers.ts';

const HOOK_NAME = 'posttooluse';

async function main(): Promise<void> {
  const input = await readStdin();
  const projectDir = resolveProjectDir();
  if (!projectDir) return;

  const toolName = (input.tool_name as string) || 'unknown';

  const sessionsDir = getSessionsDir(projectDir);
  fs.mkdirSync(sessionsDir, { recursive: true });

  const eventsPath = path.join(sessionsDir, EVENTS_FILE);
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
