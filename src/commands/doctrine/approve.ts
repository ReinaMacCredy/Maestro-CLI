/**
 * maestro doctrine-approve -- approve a doctrine suggestion.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { requireDoctrinePort, parseTags } from '../../lib/resolve.ts';
import { CURRENT_SCHEMA_VERSION } from '../../adapters/fs/doctrine.ts';
import type { DoctrineItem } from '../../ports/doctrine.ts';

export default defineCommand({
  meta: { name: 'doctrine-approve', description: 'Approve a doctrine suggestion' },
  args: {
    name: { type: 'string', description: 'Doctrine item name (kebab-case)', required: true },
    rule: { type: 'string', description: 'The operating rule', required: true },
    rationale: { type: 'string', description: 'Why this rule exists', required: true },
    tags: { type: 'string', description: 'Comma-separated tags' },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const doctrinePort = requireDoctrinePort(services);

      const now = new Date().toISOString();
      const tags = parseTags(args.tags);
      const item: DoctrineItem = {
        name: args.name,
        rule: args.rule,
        rationale: args.rationale,
        conditions: { tags: tags.length > 0 ? tags : undefined },
        tags,
        source: { features: [], memories: [] },
        effectiveness: { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
        status: 'active',
        createdAt: now,
        updatedAt: now,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };

      const path = doctrinePort.write(item);
      output({ name: item.name, path }, () =>
        `[ok] doctrine '${item.name}' approved and saved`,
      );
    } catch (err) {
      handleCommandError('doctrine-approve', err);
    }
  },
});
