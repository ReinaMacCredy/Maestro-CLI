/**
 * Claude Code host backend adapter (stub).
 * All methods are no-op until Claude Code exposes a task management API.
 */

import type { TaskStatusType } from '../../core/types.ts';
import type { HostBackend, HostMapping } from '../port.ts';
import { readHostMapping, writeHostMapping } from '../mapping.ts';
import { getFeaturePath } from '../../core/paths.ts';

export class ClaudeCodeHostBackend implements HostBackend {
  readonly hostType = 'claude-code' as const;

  constructor(private projectRoot: string) {}

  async createTask(_feature: string, _taskId: string, _title: string): Promise<string | null> {
    // Stub: Claude Code task API not yet available
    return null;
  }

  async updateStatus(_feature: string, _taskId: string, _status: TaskStatusType): Promise<void> {
    // Stub: no-op until API available
  }

  getMapping(feature: string): HostMapping {
    return readHostMapping(getFeaturePath(this.projectRoot, feature));
  }

  setMapping(feature: string, mapping: HostMapping): void {
    writeHostMapping(getFeaturePath(this.projectRoot, feature), mapping);
  }
}
