/**
 * maestro doctrine-write -- create or update a doctrine item.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import type { DoctrineItem } from '../../ports/doctrine.ts';

export default defineCommand({
  meta: { name: 'doctrine-write', description: 'Create or update a doctrine item' },
  args: {
    name: { type: 'string', description: 'Doctrine item name (kebab-case)', required: true },
    rule: { type: 'string', description: 'The operating rule', required: true },
    rationale: { type: 'string', description: 'Why this rule exists', required: true },
    tags: { type: 'string', description: 'Comma-separated tags' },
    status: { type: 'string', description: 'Status: active, deprecated, proposed', default: 'active' },
  },
  async run({ args }) {
    try {
      const { doctrinePort } = getServices();
      if (!doctrinePort) {
        console.error('[!] Doctrine port not available');
        process.exit(1);
      }

      const existing = doctrinePort.read(args.name);
      const now = new Date().toISOString();

      const item: DoctrineItem = {
        name: args.name,
        rule: args.rule,
        rationale: args.rationale,
        conditions: { tags: args.tags ? args.tags.split(',').map(t => t.trim()) : undefined },
        tags: args.tags ? args.tags.split(',').map(t => t.trim()) : [],
        source: { features: [], memories: [] },
        effectiveness: existing?.effectiveness ?? { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
        status: (args.status as 'active' | 'deprecated' | 'proposed') ?? 'active',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        schemaVersion: 1,
      };

      const path = doctrinePort.write(item);
      output({ name: item.name, path }, () =>
        `[ok] doctrine '${item.name}' ${existing ? 'updated' : 'created'}`,
      );
    } catch (err) {
      handleCommandError('doctrine-write', err);
    }
  },
});
