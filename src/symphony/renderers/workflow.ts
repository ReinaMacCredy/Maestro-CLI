/**
 * WORKFLOW.md renderer for Symphony.
 * Reads the template from reference assets and replaces build-time placeholders.
 * Preserves runtime Jinja2 templates ({{ issue.field }}) untouched.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RenderedFile } from './context.ts';

const TEMPLATE_PATH = 'skills/built-in/maestro:symphony-setup/reference/WORKFLOW.md.template';

function resolveTemplatePath(): string {
  const candidates = [
    path.resolve(import.meta.dir, '../../../../', TEMPLATE_PATH),
    path.resolve(import.meta.dir, '../../../', TEMPLATE_PATH),
    path.resolve(process.cwd(), TEMPLATE_PATH),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Cannot find WORKFLOW.md template. Searched: ${candidates.join(', ')}`);
}

interface WorkflowParams {
  projectName: string;
  repoUrl?: string;
  linearProjectSlug?: string;
  primaryBranch: string;
}

/**
 * Render WORKFLOW.md from template with build-time placeholder replacement.
 * Uses 4 explicit .replace() calls -- no regex, no template engine.
 * Runtime Jinja2 templates ({{ issue.* }}) are preserved as-is.
 */
export function renderWorkflowMd(params: WorkflowParams): RenderedFile {
  const templatePath = resolveTemplatePath();
  let content = fs.readFileSync(templatePath, 'utf8');

  // Build-time placeholders only -- UPPER_SNAKE_CASE in double braces
  content = content.replace('{{PROJECT_NAME}}', params.projectName);
  content = content.replace('{{PROJECT_SLUG}}', params.linearProjectSlug || '');
  content = content.replace('{{REPO_CLONE_URL}}', params.repoUrl || '');
  content = content.replace('{{PRIMARY_BRANCH}}', params.primaryBranch);

  return { path: 'WORKFLOW.md', content };
}
