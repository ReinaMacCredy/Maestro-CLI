/**
 * Native context file renderers for Symphony.
 * Each function returns { path, content } for a managed file.
 */

import type { SymphonyScanSummary } from '../types.ts';

export interface RenderedFile {
  path: string;
  content: string;
}

export function renderProduct(scan: SymphonyScanSummary, projectName: string): RenderedFile {
  const lines = [`# Product: ${projectName}`, ''];
  if (scan.audience) lines.push(scan.audience, '');
  lines.push(`Project type: ${scan.projectType}`);
  return { path: '.maestro/context/product.md', content: lines.join('\n') + '\n' };
}

export function renderTechStack(scan: SymphonyScanSummary): RenderedFile {
  const lines = ['# Tech Stack', ''];
  if (scan.languages.length) lines.push(`- Languages: ${scan.languages.join(', ')}`);
  if (scan.frameworks.length) lines.push(`- Frameworks: ${scan.frameworks.join(', ')}`);
  if (scan.tools.length) lines.push(`- Tools: ${scan.tools.join(', ')}`);
  if (scan.packageManager) lines.push(`- Package manager: ${scan.packageManager}`);
  lines.push('', '## Commands', '');
  if (scan.buildCommand) lines.push(`- Build: \`${scan.buildCommand}\``);
  if (scan.testCommand) lines.push(`- Test: \`${scan.testCommand}\``);
  if (scan.devCommand) lines.push(`- Dev: \`${scan.devCommand}\``);
  if (scan.lintCommand) lines.push(`- Lint: \`${scan.lintCommand}\``);
  return { path: '.maestro/context/tech-stack.md', content: lines.join('\n') + '\n' };
}

export function renderGuidelines(scan: SymphonyScanSummary): RenderedFile {
  const lines = ['# Coding Guidelines', ''];
  const facts: string[] = [];

  if (scan.tools.includes('eslint')) facts.push('Uses ESLint for linting');
  if (scan.tools.includes('prettier')) facts.push('Uses Prettier for formatting');
  if (scan.tools.includes('biome')) facts.push('Uses Biome for linting and formatting');
  if (scan.tools.includes('ruff')) facts.push('Uses Ruff for Python linting');
  if (scan.languages.includes('typescript')) facts.push('TypeScript with strict mode');

  if (facts.length) {
    for (const f of facts) lines.push(`- ${f}`);
  } else {
    lines.push('No linter/formatter configs detected. Add conventions here after review.');
  }

  return { path: '.maestro/context/guidelines.md', content: lines.join('\n') + '\n' };
}

export function renderProductGuidelines(): RenderedFile {
  const content = [
    '# Product Guidelines',
    '',
    '## Tone and Voice',
    '',
    '<!-- Describe the product\'s tone, voice, and writing style -->',
    '',
    '## UX Principles',
    '',
    '<!-- Describe key UX principles and patterns -->',
    '',
    '## Accessibility',
    '',
    '<!-- Describe accessibility requirements -->',
    '',
  ].join('\n') + '\n';

  return { path: '.maestro/context/product-guidelines.md', content };
}

export function renderWorkflow(): RenderedFile {
  const content = [
    '# Workflow',
    '',
    'This project uses maestro for track-based development.',
    '',
    '## Quick Reference',
    '',
    '- `maestro status` -- see current state',
    '- `maestro feature-create <name>` -- start a new feature',
    '- `maestro plan-write --feature <name>` -- write a plan',
    '- `maestro plan-approve --feature <name>` -- approve the plan',
    '- `maestro task-sync --feature <name>` -- generate tasks',
    '- `maestro task-start --feature <name> --task <id>` -- start a task',
    '- `maestro task-finish` -- finish current task',
    '',
  ].join('\n') + '\n';

  return { path: '.maestro/context/workflow.md', content };
}

export function renderIndex(files: RenderedFile[]): RenderedFile {
  const lines = ['# Context Index', ''];
  for (const f of files) {
    const name = f.path.split('/').pop() || f.path;
    const firstLine = f.content.split('\n').find(l => l.startsWith('#'))?.replace(/^#+\s*/, '') || name;
    lines.push(`- [${name}](./${name}) -- ${firstLine}`);
  }
  return { path: '.maestro/context/index.md', content: lines.join('\n') + '\n' };
}

export function renderTracks(): RenderedFile {
  return { path: '.maestro/tracks.md', content: '# Tracks\n' };
}

/**
 * Generate all context files from a scan summary.
 */
export function renderAllContext(scan: SymphonyScanSummary, projectName: string): RenderedFile[] {
  const files: RenderedFile[] = [
    renderProduct(scan, projectName),
    renderTechStack(scan),
    renderGuidelines(scan),
  ];

  if (scan.hasProductGuidelines) {
    files.push(renderProductGuidelines());
  }

  files.push(renderWorkflow());
  files.push(renderIndex(files)); // index references files above it
  files.push(renderTracks());

  return files;
}
