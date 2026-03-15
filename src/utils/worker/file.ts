/**
 * Prompt file utilities for maestroCLI.
 * Forked from hive-core/src/utils/prompt-file.ts -- direct copy.
 */

import * as path from 'path';
import { getWorkerPromptPath, getTaskPath, normalizePath } from '../paths.ts';
import { ensureDir, readText as readTextFile, writeText } from '../fs-io.ts';

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
  try {
    const content = readTextFile(resolvedPath);
    if (content === null) {
      return {
        error: `Prompt file not found: "${resolvedPath}"`,
      };
    }
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
  projectRoot: string,
): string {
  const promptPath = getWorkerPromptPath(projectRoot, feature, task);
  ensureDir(getTaskPath(projectRoot, feature, task));
  writeText(promptPath, prompt);

  return promptPath;
}
