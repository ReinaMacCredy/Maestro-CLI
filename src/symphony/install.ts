/**
 * Core install logic for `maestro symphony install`.
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
import { writeManifest } from './manifest.ts';
import { detectInstallState, detectProjectName, detectRepoUrl, detectPrimaryBranch } from './state-detection.ts';
import type { SymphonyManifest, SymphonyPlannedAction, ManagedFileRole } from './types.ts';

export interface InstallOptions {
  projectRoot: string;
  dryRun: boolean;
  force: boolean;
  yes: boolean;
  linearProject?: string;
  repoUrl?: string;
}

export interface InstallResult {
  state: string;
  projectName: string;
  scanSummary: ReturnType<typeof scanRepo>;
  actions: SymphonyPlannedAction[];
  actionSummary: ReturnType<typeof summarizeActions>;
  applied: boolean;
  manifestWritten: boolean;
}

export async function executeInstall(opts: InstallOptions): Promise<InstallResult> {
  const { projectRoot, dryRun, force } = opts;

  // 1. Detect state
  const state = detectInstallState(projectRoot);
  const projectName = detectProjectName(projectRoot);
  const repoUrl = opts.repoUrl || detectRepoUrl(projectRoot);
  const primaryBranch = detectPrimaryBranch(projectRoot);

  // 2. Bootstrap directories
  if (!dryRun) {
    ensureDir(path.join(projectRoot, '.maestro'));
    ensureDir(path.join(projectRoot, '.maestro', 'symphony'));
    ensureDir(path.join(projectRoot, '.maestro', 'context'));
    ensureDir(path.join(projectRoot, '.maestro', 'features'));

    // br init (non-fatal)
    const beadsPath = path.join(projectRoot, '.beads');
    if (!fs.existsSync(beadsPath)) {
      try {
        const proc = Bun.spawn(['br', 'init'], { cwd: projectRoot, stdout: 'pipe', stderr: 'pipe' });
        await proc.exited;
      } catch { /* br not installed -- not fatal */ }
    }
  }

  // 3. Scan repo
  const scanSummary = scanRepo(projectRoot);

  // 4. Generate all file content in memory
  const plannedFiles: { path: string; role: ManagedFileRole; content: string }[] = [];

  // Context files
  const contextFiles = renderAllContext(scanSummary, projectName);
  for (const cf of contextFiles) {
    const role: ManagedFileRole = cf.path.includes('tracks.md') ? 'tracks' : 'context';
    plannedFiles.push({ path: cf.path, role, content: cf.content });
  }

  // AGENTS.md
  const agentsContent = renderAgentsMd(scanSummary, projectName);
  plannedFiles.push({ path: 'AGENTS.md', role: 'agents', content: agentsContent });

  // Codex skills
  const codexSkills = collectCodexSkills();
  for (const skill of codexSkills) {
    plannedFiles.push({ path: skill.path, role: 'codex-skill', content: skill.content });
  }

  // WORKFLOW.md
  const workflow = renderWorkflowMd({
    projectName,
    repoUrl,
    linearProjectSlug: opts.linearProject,
    primaryBranch,
  });
  plannedFiles.push({ path: workflow.path, role: 'workflow', content: workflow.content });

  // 5. Build action plan (reads existing manifest if present)
  const { readManifest: readMfst } = await import('./manifest.ts');
  const existingManifest = readMfst(projectRoot);
  const actions = buildActionPlan(projectRoot, plannedFiles, existingManifest, force);
  const actionSummary = summarizeActions(actions);

  if (dryRun) {
    return { state, projectName, scanSummary, actions, actionSummary, applied: false, manifestWritten: false };
  }

  // 6. Apply -- write files
  for (const action of actions) {
    if (action.action === 'create' || action.action === 'update') {
      const absPath = path.join(projectRoot, action.path);
      ensureDir(path.dirname(absPath));
      fs.writeFileSync(absPath, action.content!, 'utf8');
    }
    // preserve-existing, unchanged, conflict -- skip
  }

  // 7. Write manifest last
  const managedFiles = actions
    .filter(a => a.action === 'create' || a.action === 'update' || a.action === 'unchanged')
    .map(a => ({
      path: a.path,
      role: a.role,
      contentHash: a.action === 'unchanged' ? a.manifestHash! : hashContent(a.content!),
    }));

  const now = new Date().toISOString();
  const manifest: SymphonyManifest = {
    version: 1,
    installedAt: existingManifest?.installedAt || now,
    lastSyncedAt: now,
    linearProjectSlug: opts.linearProject,
    repoUrl,
    primaryBranch,
    scanSummary,
    managedFiles,
  };

  writeManifest(projectRoot, manifest);

  return { state, projectName, scanSummary, actions, actionSummary, applied: true, manifestWritten: true };
}
