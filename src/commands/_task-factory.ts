/**
 * Factory for task/subtask commands that share identical logic.
 * Eliminates 6 pairs of near-duplicate command files.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output, renderStatusLine } from '../lib/output.ts';
import { formatError, handleCommandError, MaestroError } from '../lib/errors.ts';
import type { TaskStatusType, TaskInfo } from '../types.ts';
import { VALID_TRANSITIONS } from '../ports/tasks.ts';

const VALID_STATUSES = Object.keys(VALID_TRANSITIONS) as TaskStatusType[];

export function parseStatus(raw: string): TaskStatusType {
  if (!VALID_STATUSES.includes(raw as TaskStatusType)) {
    throw new MaestroError(
      `Invalid status '${raw}'`,
      [`Valid values: ${VALID_STATUSES.join(', ')}`],
    );
  }
  return raw as TaskStatusType;
}

type Entity = 'task' | 'subtask';
const entityLabel = (e: Entity) => e === 'task' ? 'Task' : 'Subtask';

export function makeInfoCommand(entity: Entity) {
  const label = entityLabel(entity);
  return defineCommand({
    meta: { name: `${entity}-info`, description: `Show ${entity} details` },
    args: {
      feature: { type: 'string' as const, description: 'Feature name', required: true },
      task: { type: 'string' as const, description: `${label} ID (folder name)`, required: true },
    },
    async run({ args }) {
      try {
        const { taskPort } = getServices();
        const info = await taskPort.get(args.feature, args.task);
        if (!info) {
          console.error(formatError(`${entity}-info`, `${label} '${args.task}' not found in feature '${args.feature}'`));
          process.exit(1);
        }
        output(info, (t: TaskInfo) =>
          [
            renderStatusLine('Folder', t.folder),
            renderStatusLine('Name', t.name),
            renderStatusLine('Status', t.status),
            renderStatusLine('Origin', t.origin),
            t.planTitle ? renderStatusLine('Plan title', t.planTitle) : null,
            t.summary ? renderStatusLine('Summary', t.summary) : null,
            t.dependsOn?.length ? renderStatusLine('Depends on', t.dependsOn.join(', ')) : null,
          ].filter(Boolean).join('\n'),
        );
      } catch (err) {
        handleCommandError(`${entity}-info`, err);
      }
    },
  });
}

export function makeUpdateCommand(entity: Entity) {
  const label = entityLabel(entity);
  return defineCommand({
    meta: { name: `${entity}-update`, description: `Update ${entity} status or notes` },
    args: {
      feature: { type: 'string' as const, description: 'Feature name', required: true },
      task: { type: 'string' as const, description: `${label} ID (folder name)`, required: true },
      status: { type: 'string' as const, description: 'New status' },
      notes: { type: 'string' as const, description: 'Notes to add' },
    },
    async run({ args }) {
      try {
        if (args.status) parseStatus(args.status);
        const { taskPort } = getServices();
        const result = await taskPort.update(args.feature, args.task, {
          status: args.status as TaskStatusType | undefined,
          notes: args.notes,
        });
        output(result, (r: TaskInfo) =>
          `[ok] ${entity} updated: ${r.folder} --> status=${r.status}`,
        );
      } catch (err) {
        handleCommandError(`${entity}-update`, err);
      }
    },
  });
}

export function makeDocReadCommand(entity: Entity, docType: 'spec' | 'report') {
  const label = entityLabel(entity);
  const portMethod = docType === 'spec' ? 'readSpec' as const : 'readReport' as const;
  return defineCommand({
    meta: { name: `${entity}-${docType}-read`, description: `Read ${entity} ${docType}` },
    args: {
      feature: { type: 'string' as const, description: 'Feature name', required: true },
      task: { type: 'string' as const, description: `${label} ID (folder name)`, required: true },
    },
    async run({ args }) {
      try {
        const { taskPort } = getServices();
        const content = await taskPort[portMethod](args.feature, args.task);
        if (content === null) {
          console.error(formatError(`${entity}-${docType}-read`, `No ${docType} found for ${entity} '${args.task}'`));
          process.exit(1);
        }
        output({ content }, () => content);
      } catch (err) {
        handleCommandError(`${entity}-${docType}-read`, err);
      }
    },
  });
}

export function makeDocWriteCommand(entity: Entity, docType: 'spec' | 'report') {
  const label = entityLabel(entity);
  const portMethod = docType === 'spec' ? 'writeSpec' as const : 'writeReport' as const;
  return defineCommand({
    meta: { name: `${entity}-${docType}-write`, description: `Write ${entity} ${docType}` },
    args: {
      feature: { type: 'string' as const, description: 'Feature name', required: true },
      task: { type: 'string' as const, description: `${label} ID (folder name)`, required: true },
      content: { type: 'string' as const, description: `${label} ${docType} content`, required: true },
    },
    async run({ args }) {
      try {
        const { taskPort } = getServices();
        await taskPort[portMethod](args.feature, args.task, args.content);
        output({ task: args.task }, () =>
          `[ok] ${docType} written for ${entity} '${args.task}'`,
        );
      } catch (err) {
        handleCommandError(`${entity}-${docType}-write`, err);
      }
    },
  });
}
