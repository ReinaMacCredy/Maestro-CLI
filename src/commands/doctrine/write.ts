/**
 * maestro doctrine-write -- create or update a doctrine item.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';
import { requireDoctrinePort, parseTags } from '../../lib/resolve.ts';
import { CURRENT_SCHEMA_VERSION } from '../../adapters/fs/doctrine.ts';
import type { DoctrineItem, DoctrineStatus } from '../../ports/doctrine.ts';

const VALID_STATUSES = new Set<DoctrineStatus>(['active', 'deprecated', 'proposed']);

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
      const services = getServices();
      const doctrinePort = requireDoctrinePort(services);

      const existing = doctrinePort.read(args.name);
      const now = new Date().toISOString();
      const tags = parseTags(args.tags);
      const status = VALID_STATUSES.has(args.status as DoctrineStatus)
        ? (args.status as DoctrineStatus)
        : 'active';

      const item: DoctrineItem = {
        name: args.name,
        rule: args.rule,
        rationale: args.rationale,
        conditions: { tags: tags.length > 0 ? tags : undefined },
        tags,
        source: { features: [], memories: [] },
        effectiveness: existing?.effectiveness ?? { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
        status,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        schemaVersion: CURRENT_SCHEMA_VERSION,
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
