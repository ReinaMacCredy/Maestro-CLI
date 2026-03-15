/**
 * Core sync logic for `maestro symphony sync`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir } from '../utils/fs-io.ts';
import { scanRepo } from './scanner.ts';
import { renderAllContext } from './renderers/context.ts';
import { renderAgentsMd } from './renderers/agents.ts';
import { renderWorkflowMd } from './renderers/workflow.ts';
import { collectCodexSkills } from './renderers/codex-skills.ts';
import { buildActionPlan, summarizeActions } from './actions.ts';
import { hashContent } from './hashing.ts';
import { readManifest, writeManifest } from './manifest.ts';
import { detectProjectName } from './state-detection.ts';
import type { SymphonyManifest, SymphonyPlannedAction, ManagedFileRole } from './types.ts';

export interface SyncOptions {
  projectRoot: string;
  dryRun: boolean;
  force: boolean;
}

export interface SyncResult {
  actions: SymphonyPlannedAction[];
  actionSummary: ReturnType<typeof summarizeActions>;
  applied: boolean;
}

export function executeSync(opts: SyncOptions): SyncResult {
  const { projectRoot, dryRun, force } = opts;

  const manifest = readManifest(projectRoot);
  if (!manifest) {
    throw new Error('No Symphony manifest found. Run `maestro symphony install` first.');
  }

  const projectName = detectProjectName(projectRoot);
  const scanSummary = scanRepo(projectRoot);

  // Regenerate all managed file content
  const plannedFiles: { path: string; role: ManagedFileRole; content: string }[] = [];

  const contextFiles = renderAllContext(scanSummary, projectName);
  for (const cf of contextFiles) {
    const role: ManagedFileRole = cf.path.includes('tracks.md') ? 'tracks' : 'context';
    plannedFiles.push({ path: cf.path, role, content: cf.content });
  }

  plannedFiles.push({ path: 'AGENTS.md', role: 'agents', content: renderAgentsMd(scanSummary, projectName) });

  const codexSkills = collectCodexSkills();
  for (const skill of codexSkills) {
    plannedFiles.push({ path: skill.path, role: 'codex-skill', content: skill.content });
  }

  const workflow = renderWorkflowMd({
    projectName,
    repoUrl: manifest.repoUrl,
    linearProjectSlug: manifest.linearProjectSlug,
    primaryBranch: manifest.primaryBranch,
  });
  plannedFiles.push({ path: workflow.path, role: 'workflow', content: workflow.content });

  const actions = buildActionPlan(projectRoot, plannedFiles, manifest, force);
  const actionSummary = summarizeActions(actions);

  if (dryRun) {
    return { actions, actionSummary, applied: false };
  }

  // Apply writes
  for (const action of actions) {
    if (action.action === 'create' || action.action === 'update') {
      const absPath = path.join(projectRoot, action.path);
      ensureDir(path.dirname(absPath));
      fs.writeFileSync(absPath, action.content!, 'utf8');
    }
  }

  // Update manifest
  const managedFiles = actions
    .filter(a => a.action === 'create' || a.action === 'update' || a.action === 'unchanged')
    .map(a => ({
      path: a.path,
      role: a.role,
      contentHash: a.action === 'unchanged' ? a.manifestHash! : hashContent(a.content!),
    }));

  const updated: SymphonyManifest = {
    ...manifest,
    lastSyncedAt: new Date().toISOString(),
    scanSummary,
    managedFiles,
  };

  writeManifest(projectRoot, updated);

  return { actions, actionSummary, applied: true };
}
