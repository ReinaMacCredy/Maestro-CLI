/**
 * Prompt file utilities for maestroCLI.
 * Forked from hive-core/src/utils/prompt-file.ts -- direct copy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizePath } from './paths.ts';

export interface PromptFileResult {
  content?: string;
  error?: string;
}

export function isValidPromptFilePath(filePath: string, workspaceRoot: string): boolean {
  try {
    const normalizedFilePath = path.resolve(filePath);
    const normalizedWorkspace = path.resolve(workspaceRoot);
    let normalizedFilePathForCompare = normalizePath(normalizedFilePath);
    let normalizedWorkspaceForCompare = normalizePath(normalizedWorkspace);

    if (process.platform === 'win32') {
      normalizedFilePathForCompare = normalizedFilePathForCompare.toLowerCase();
      normalizedWorkspaceForCompare = normalizedWorkspaceForCompare.toLowerCase();
    }

    if (!normalizedFilePathForCompare.startsWith(normalizedWorkspaceForCompare + '/') &&
        normalizedFilePathForCompare !== normalizedWorkspaceForCompare) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function resolvePromptFromFile(
  promptFilePath: string,
  workspaceRoot: string
): Promise<PromptFileResult> {
  if (!isValidPromptFilePath(promptFilePath, workspaceRoot)) {
    return {
      error: `Prompt file path "${promptFilePath}" is outside the workspace. ` +
             `Only files within "${workspaceRoot}" are allowed.`,
    };
  }

  const resolvedPath = path.resolve(promptFilePath);
  if (!fs.existsSync(resolvedPath)) {
    return {
      error: `Prompt file not found: "${resolvedPath}"`,
    };
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return { content };
  } catch (err) {
    return {
      error: `Failed to read prompt file: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

export function writeWorkerPromptFile(
  feature: string,
  task: string,
  prompt: string,
  hiveDir: string
): string {
  const promptDir = path.join(hiveDir, 'features', feature, 'tasks', task);
  const promptPath = path.join(promptDir, 'worker-prompt.md');

  if (!fs.existsSync(promptDir)) {
    fs.mkdirSync(promptDir, { recursive: true });
  }

  fs.writeFileSync(promptPath, prompt, 'utf-8');

  return promptPath;
}
