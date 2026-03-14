import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdin, writeOutput, resolveProjectDir, logHookError, HOOK_EVENTS } from './_helpers.ts';

const HOOK_NAME = 'pretooluse';

interface GitContext {
  inWorktree: boolean;
  onMaestroBranch: boolean;
}

/** Single upward walk that detects both .maestro-worktree marker and git HEAD branch. */
function detectGitContext(): GitContext {
  let inWorktree = false;
  let headRef: string | null = null;
  let foundGit = false;

  let current = process.cwd();
  while (true) {
    // Check for maestro worktree marker
    if (!inWorktree) {
      try {
        fs.statSync(path.join(current, '.maestro-worktree'));
        inWorktree = true;
      } catch {
        // Not found at this level
      }
    }

    // Check for .git (dir or worktree file)
    if (!foundGit) {
      const gitPath = path.join(current, '.git');
      try {
        const stat = fs.statSync(gitPath);
        foundGit = true;
        if (stat.isDirectory()) {
          headRef = fs.readFileSync(path.join(gitPath, 'HEAD'), 'utf-8').trim();
        } else if (stat.isFile()) {
          // Worktree -- .git is a file with "gitdir: <path>"
          const content = fs.readFileSync(gitPath, 'utf-8').trim();
          const m = content.match(/^gitdir:\s*(.+)$/);
          if (m) {
            const gitDir = path.isAbsolute(m[1]) ? m[1] : path.resolve(current, m[1]);
            headRef = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim();
          }
        }
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT' && code !== 'ENOTDIR') throw e;
      }
    }

    if (inWorktree && foundGit) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  let onMaestroBranch = false;
  if (headRef) {
    const ref = headRef.match(/^ref: refs\/heads\/(.+)$/);
    onMaestroBranch = ref ? ref[1].startsWith('maestro/') : false;
  }

  return { inWorktree, onMaestroBranch };
}

async function main(): Promise<void> {
  const input = await readStdin();
  const toolName = input.tool_name as string | undefined;
  const toolInput = (input.tool_input as Record<string, unknown>) || {};

  if (toolName !== 'Bash') return;

  const command = (toolInput.command as string) || '';

  // Only run filesystem detection if the command involves git operations we care about
  const isGitOp = /\bgit\s+(commit|push|merge)\b/.test(command);
  if (!isGitOp) return;

  const { inWorktree, onMaestroBranch } = detectGitContext();

  // Check for git commit outside worktree
  if (/\bgit\s+commit\b/.test(command)) {
    if (!inWorktree && !onMaestroBranch) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: HOOK_EVENTS.PreToolUse,
          additionalContext:
            'Consider using maestro_worktree_commit to track task progress and maintain workflow state.',
        },
      });
      return;
    }
  }

  // Check for git push in worktree or on maestro branch
  if (/\bgit\s+push\b/.test(command)) {
    if (inWorktree) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: HOOK_EVENTS.PreToolUse,
          additionalContext:
            'You are in a maestro worktree. Use maestro_worktree_commit to complete the task instead of git push.',
        },
      });
      return;
    }
    if (onMaestroBranch) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: HOOK_EVENTS.PreToolUse,
          additionalContext:
            'This branch is managed by maestro. Use maestro_merge instead of git push to maintain workflow state.',
        },
      });
      return;
    }
  }

  // Check for git merge on maestro branch or in worktree
  if (/\bgit\s+merge\b/.test(command)) {
    if (inWorktree || onMaestroBranch) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: HOOK_EVENTS.PreToolUse,
          additionalContext:
            'Use maestro_merge instead of git merge to maintain workflow state (task status, branch cleanup).',
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
