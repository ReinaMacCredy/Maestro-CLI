/**
 * Symphony-aware AGENTS.md generator.
 * Emits concrete commands and architectural boundaries from scan results.
 */

import type { SymphonyScanSummary } from '../types.ts';

export function renderAgentsMd(scan: SymphonyScanSummary, projectName: string): string {
  const sections: string[] = [];

  // Header
  sections.push(`# ${projectName}\n`);

  // Build/test/dev commands
  const cmds: string[] = [];
  if (scan.buildCommand) cmds.push(`- Build: \`${scan.buildCommand}\``);
  if (scan.testCommand) cmds.push(`- Test: \`${scan.testCommand}\``);
  if (scan.devCommand) cmds.push(`- Dev: \`${scan.devCommand}\``);
  if (scan.lintCommand) cmds.push(`- Lint: \`${scan.lintCommand}\``);
  if (cmds.length) {
    sections.push('## Commands\n');
    sections.push(cmds.join('\n'));
  }

  // Architecture
  if (scan.sourceRoots.length || scan.isMonorepo) {
    sections.push('\n## Architecture\n');
    if (scan.sourceRoots.length) {
      sections.push(`Source roots: ${scan.sourceRoots.map(r => `\`${r}/\``).join(', ')}`);
    }
    if (scan.isMonorepo && scan.monorepoPackages?.length) {
      sections.push(`\nMonorepo packages: ${scan.monorepoPackages.map(p => `\`${p}\``).join(', ')}`);
    }
  }

  // Conventions from detected tools
  const conventions: string[] = [];
  if (scan.tools.includes('eslint')) conventions.push('- ESLint enforces code quality');
  if (scan.tools.includes('prettier')) conventions.push('- Prettier enforces formatting');
  if (scan.tools.includes('biome')) conventions.push('- Biome handles linting and formatting');
  if (scan.tools.includes('ruff')) conventions.push('- Ruff handles Python linting');
  if (scan.packageManager) conventions.push(`- Use \`${scan.packageManager}\` (not npm/yarn) for package operations`);

  if (conventions.length) {
    sections.push('\n## Conventions\n');
    sections.push(conventions.join('\n'));
  }

  return sections.join('\n') + '\n';
}
