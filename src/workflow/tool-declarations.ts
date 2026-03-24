/**
 * Workflow metadata declarations for all MCP tools.
 * Centralized registry population -- called once during server startup.
 */

import type { WorkflowRegistry } from './registry.ts';

/**
 * Register workflow metadata for all MCP tools.
 */
export function declareAllTools(registry: WorkflowRegistry): void {
  // =========================================================================
  // Feature tools
  // =========================================================================
  registry.register('maestro_feature_create', { stages: ['discovery'], category: 'primary' });
  registry.register('maestro_feature_list', { stages: [], category: 'meta' });
  registry.register('maestro_feature_info', { stages: [], category: 'meta' });
  registry.register('maestro_feature_active', { stages: [], category: 'meta' });
  registry.register('maestro_feature_complete', { stages: ['done'], category: 'primary' });

  // =========================================================================
  // Plan tools
  // =========================================================================
  registry.register('maestro_plan_write', { stages: ['planning'], category: 'primary' });
  registry.register('maestro_plan_read', { stages: ['planning'], category: 'meta' });
  registry.register('maestro_plan_approve', { stages: ['planning'], category: 'primary', prerequisites: ['maestro_plan_write'] });
  registry.register('maestro_plan_comment', { stages: ['planning'], category: 'utility' });
  registry.register('maestro_plan_revoke', { stages: [], category: 'utility' });
  registry.register('maestro_plan_comments_clear', { stages: [], category: 'utility' });

  // =========================================================================
  // Task tools
  // =========================================================================
  registry.register('maestro_tasks_sync', { stages: ['approval'], category: 'primary', prerequisites: ['maestro_plan_approve'] });
  registry.register('maestro_task_next', { stages: ['execution'], category: 'primary' });
  registry.register('maestro_task_claim', { stages: ['execution'], category: 'primary', prerequisites: ['maestro_task_next'] });
  registry.register('maestro_task_done', { stages: ['execution'], category: 'primary' });
  registry.register('maestro_task_block', { stages: ['execution'], category: 'primary' });
  registry.register('maestro_task_unblock', { stages: ['execution'], category: 'primary' });
  registry.register('maestro_task_accept', { stages: ['execution'], category: 'primary' });
  registry.register('maestro_task_reject', { stages: ['execution'], category: 'primary' });
  registry.register('maestro_task_brief', { stages: ['execution'], category: 'primary' });
  registry.register('maestro_task_list', { stages: ['execution'], category: 'meta' });
  registry.register('maestro_task_info', { stages: ['execution'], category: 'meta' });
  registry.register('maestro_task_spec_read', { stages: ['execution'], category: 'meta' });
  registry.register('maestro_task_spec_write', { stages: ['execution'], category: 'utility' });
  registry.register('maestro_task_report_read', { stages: [], category: 'meta' });
  registry.register('maestro_task_report_write', { stages: ['execution'], category: 'utility' });

  // =========================================================================
  // Memory tools
  // =========================================================================
  registry.register('maestro_memory_write', { stages: ['discovery', 'research'], category: 'primary' });
  registry.register('maestro_memory_read', { stages: [], category: 'meta' });
  registry.register('maestro_memory_list', { stages: [], category: 'meta' });
  registry.register('maestro_memory_promote', { stages: ['done'], category: 'primary' });
  registry.register('maestro_memory_delete', { stages: [], category: 'utility' });
  registry.register('maestro_memory_archive', { stages: [], category: 'utility' });
  registry.register('maestro_memory_consolidate', { stages: ['done'], category: 'primary' });
  registry.register('maestro_memory_compile', { stages: [], category: 'utility' });
  registry.register('maestro_memory_stats', { stages: [], category: 'meta' });

  // =========================================================================
  // Doctrine tools
  // =========================================================================
  registry.register('maestro_doctrine_suggest', { stages: ['done'], category: 'primary' });
  registry.register('maestro_doctrine_approve', { stages: ['done'], category: 'primary' });
  registry.register('maestro_doctrine_write', { stages: ['done'], category: 'primary' });
  registry.register('maestro_doctrine_list', { stages: [], category: 'meta' });
  registry.register('maestro_doctrine_read', { stages: [], category: 'meta' });
  registry.register('maestro_doctrine_deprecate', { stages: [], category: 'utility' });

  // =========================================================================
  // Skill tools
  // =========================================================================
  registry.register('maestro_skill', { stages: [], category: 'meta' });
  registry.register('maestro_skill_list', { stages: [], category: 'meta' });

  // =========================================================================
  // Graph tools (conditional: requires bv)
  // =========================================================================
  registry.register('maestro_graph_insights', { stages: ['execution'], category: 'conditional', requires: 'bv' });
  registry.register('maestro_graph_next', { stages: ['execution'], category: 'conditional', requires: 'bv' });
  registry.register('maestro_graph_plan', { stages: ['execution'], category: 'conditional', requires: 'bv' });

  // =========================================================================
  // Search tools (conditional: requires cass)
  // =========================================================================
  registry.register('maestro_search_sessions', { stages: ['discovery', 'research'], category: 'conditional', requires: 'cass' });
  registry.register('maestro_search_related', { stages: ['discovery', 'research'], category: 'conditional', requires: 'cass' });

  // =========================================================================
  // Handoff tools (conditional: requires agent-mail)
  // =========================================================================
  registry.register('maestro_handoff_send', { stages: ['execution'], category: 'conditional', requires: 'agent-mail' });
  registry.register('maestro_handoff_receive', { stages: ['execution'], category: 'conditional', requires: 'agent-mail' });
  registry.register('maestro_handoff_ack', { stages: ['execution'], category: 'conditional', requires: 'agent-mail' });

  // =========================================================================
  // Config tools
  // =========================================================================
  registry.register('maestro_config_get', { stages: [], category: 'meta' });
  registry.register('maestro_config_set', { stages: [], category: 'utility' });

  // =========================================================================
  // Meta / utility tools
  // =========================================================================
  registry.register('maestro_status', { stages: ['discovery', 'research', 'planning', 'approval', 'execution', 'done'], category: 'meta' });
  registry.register('maestro_ping', { stages: [], category: 'meta' });
  registry.register('maestro_doctor', { stages: [], category: 'meta' });
  registry.register('maestro_init', { stages: [], category: 'utility' });
  registry.register('maestro_dcp_preview', { stages: [], category: 'utility' });
  registry.register('maestro_execution_insights', { stages: ['done'], category: 'meta' });
  registry.register('maestro_visual', { stages: [], category: 'meta' });
  registry.register('maestro_debug_visual', { stages: [], category: 'utility' });
  registry.register('maestro_history', { stages: [], category: 'meta' });
}
