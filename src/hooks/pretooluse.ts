import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdin, writeOutput, resolveProjectDir, logHookError } from './_helpers.ts';

const HOOK_NAME = 'pretooluse';

function isInWorktree(): boolean {
  // Check for .maestro-worktree marker walking up from cwd
  let current = process.cwd();
  while (true) {
    const marker = path.join(current, '.maestro-worktree');
    if (fs.existsSync(marker)) return true;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return false;
}

function isOnMaestroBranch(): boolean {
  try {
    // Read .git/HEAD directly instead of spawning git (avoids ~40ms subprocess cost)
    const head = fs.readFileSync(path.join(process.cwd(), '.git', 'HEAD'), 'utf-8').trim();
    // HEAD format: "ref: refs/heads/<branch>"
    const match = head.match(/^ref: refs\/heads\/(.+)$/);
    return match ? match[1].startsWith('maestro/') : false;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const input = await readStdin();
  const toolName = input.tool_name as string | undefined;
  const toolInput = (input.tool_input as Record<string, unknown>) || {};

  if (toolName !== 'Bash') return;

  const command = (toolInput.command as string) || '';

  // Check for git commit outside worktree
  if (/\bgit\s+commit\b/.test(command)) {
    if (!isInWorktree() && !isOnMaestroBranch()) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext:
            'Consider using maestro_worktree_commit to track task progress and maintain workflow state.',
        },
      });
      return;
    }
  }

  // Check for git push on maestro branch
  if (/\bgit\s+push\b/.test(command)) {
    if (isOnMaestroBranch()) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext:
            'This branch is managed by maestro. Consider using maestro_merge instead of git push to maintain workflow state.',
        },
      });
      return;
    }
  }

  // All other cases: allow silently (no output)
}

try {
  await main();
} catch (error) {
  logHookError(resolveProjectDir(), HOOK_NAME, error);
  // No output on error -- allows tool to proceed
}
