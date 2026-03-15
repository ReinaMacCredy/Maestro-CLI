/**
 * maestro symphony install -- onboard a repo with Symphony.
 */

import { defineCommand } from 'citty';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { checkPrerequisites } from '../../symphony/prerequisites.ts';
import { executeInstall } from '../../symphony/install.ts';
import type { SymphonyPlannedAction } from '../../symphony/types.ts';

function formatActionTable(actions: SymphonyPlannedAction[]): string {
  const rows = actions.map(a => [a.path, a.action]);
  return renderTable(['file', 'action'], rows);
}

export default defineCommand({
  meta: { name: 'install', description: 'Install Symphony onboarding for current project' },
  args: {
    'dry-run': {
      type: 'boolean',
      description: 'Show planned actions without writing files',
      default: false,
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing unmanaged files',
      default: false,
    },
    'linear-project': {
      type: 'string',
      description: 'Linear project slug for integration',
    },
    'repo-url': {
      type: 'string',
      description: 'Git remote URL (auto-detected if omitted)',
    },
  },
  async run({ args }) {
    try {
      const projectRoot = process.cwd();
      const dryRun = args['dry-run'] as boolean;
      const yes = args.yes as boolean;
      const force = args.force as boolean;
      const linearProject = args['linear-project'] as string | undefined;
      const repoUrl = args['repo-url'] as string | undefined;

      // Prerequisite check
      const prereqs = checkPrerequisites({ linearProject });
      if (!prereqs.passed) {
        const failures = prereqs.results.filter(r => !r.ok);
        const msgs = failures.map(f => `  [x] ${f.tool}: ${f.message}`);
        console.error('Prerequisites not met:\n' + msgs.join('\n'));
        process.exit(1);
      }

      // Non-interactive guard
      if (!dryRun && !yes && !process.stdin.isTTY) {
        console.error('Mutating install requires --yes in non-interactive mode.');
        process.exit(1);
      }

      const result = await executeInstall({
        projectRoot,
        dryRun,
        force,
        yes,
        linearProject,
        repoUrl,
      });

      output(result, (r) => {
        const lines: string[] = [];
        lines.push(`Project: ${r.projectName} (${r.state})`);
        lines.push(`Type: ${r.scanSummary.projectType}`);
        if (r.scanSummary.languages.length) {
          lines.push(`Languages: ${r.scanSummary.languages.join(', ')}`);
        }
        lines.push('');
        lines.push(formatActionTable(r.actions));
        lines.push('');

        const s = r.actionSummary;
        const parts: string[] = [];
        if (s.create) parts.push(`${s.create} created`);
        if (s.update) parts.push(`${s.update} updated`);
        if (s.unchanged) parts.push(`${s.unchanged} unchanged`);
        if (s['preserve-existing']) parts.push(`${s['preserve-existing']} preserved`);
        if (s.conflict) parts.push(`${s.conflict} conflicts`);
        lines.push(parts.join(', '));

        if (dryRun) {
          lines.push('\n[dry-run] No files written.');
        } else if (r.applied) {
          lines.push('\n[ok] Symphony installed. Run `maestro symphony status` to verify.');
        }

        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('symphony install', err);
    }
  },
});
