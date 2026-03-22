/**
 * Execution Timeline: Task completion events + knowledge flow graph.
 * Uses Mermaid for knowledge flow, CSS timeline for events.
 */

import type { TemplateRenderer, ExecutionTimelineData } from '../types.ts';
import { escapeHtml, sanitizeMermaidLabel } from '../renderer.ts';
import { MERMAID_CDN, ZOOM_CONTROLS_SCRIPT } from '../css.ts';

function buildKnowledgeFlow(data: ExecutionTimelineData): string {
  if (data.knowledgeFlow.length === 0) return '';

  const lines = ['flowchart LR'];
  const nodes = new Set<string>();

  for (const edge of data.knowledgeFlow) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    const label = edge.proximity > 0.7 ? 'strong' : edge.proximity > 0.3 ? 'moderate' : 'weak';
    lines.push(`  ${sanitizeMermaidLabel(edge.from)} -->|${label}| ${sanitizeMermaidLabel(edge.to)}`);
  }

  return lines.join('\n');
}

function doctrineTable(data: ExecutionTimelineData): string {
  if (!data.doctrineEffectiveness || data.doctrineEffectiveness.length === 0) return '';

  const rows = data.doctrineEffectiveness.map(d => `
    <tr>
      <td>${escapeHtml(d.name)}</td>
      <td>${d.injectionCount}</td>
      <td>${(d.successRate * 100).toFixed(0)}%</td>
      <td>${d.overrideCount}</td>
      <td>${d.stale ? '<span class="badge badge--revision">stale</span>' : '<span class="badge badge--done">active</span>'}</td>
    </tr>
  `).join('');

  return `
    <div class="section animate" style="--i: 20; margin-top: 1.5rem">
      <div class="section-label">Doctrine Effectiveness</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Injections</th><th>Success Rate</th><th>Overrides</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

export const renderExecutionTimeline: TemplateRenderer<ExecutionTimelineData> = (input) => {
  const { data } = input;

  if (data.insights.length === 0) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">${escapeHtml(data.feature)} -- execution timeline</p>
        <div class="placeholder">No execution data yet. Complete tasks to build the timeline.</div>
      `,
    };
  }

  const pct = data.coverage.percent;
  const flowDef = buildKnowledgeFlow(data);

  const timelineEntries = data.insights.map((insight, i) => `
    <div class="timeline__entry animate" style="--i: ${i + 3}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem">
        <strong>${escapeHtml(insight.sourceTask)}</strong>
        ${insight.verificationPassed
          ? '<span class="badge badge--done">passed</span>'
          : '<span class="badge badge--blocked">failed</span>'}
      </div>
      <p style="font-size: 0.875rem">${escapeHtml(insight.summary)}</p>
      <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.25rem">
        ${insight.filesChanged} files changed
        ${insight.tags.length > 0 ? ` &middot; ${insight.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}` : ''}
        ${insight.downstreamTasks.length > 0 ? ` &middot; unblocked: ${insight.downstreamTasks.map(d => escapeHtml(d)).join(', ')}` : ''}
      </div>
    </div>
  `).join('');

  const bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">${escapeHtml(data.feature)} -- execution timeline</p>

    <div class="grid" style="margin-bottom: 1.5rem">
      <div class="kpi animate" style="--i: 0">
        <div class="kpi__value">${data.insights.length}</div>
        <div class="kpi__label">Completed Tasks</div>
      </div>
      <div class="kpi animate" style="--i: 1">
        <div class="kpi__value">${pct.toFixed(0)}%</div>
        <div class="kpi__label">Coverage</div>
      </div>
      <div class="kpi animate" style="--i: 2">
        <div class="kpi__value">${data.knowledgeFlow.length}</div>
        <div class="kpi__label">Knowledge Edges</div>
      </div>
    </div>

    <div class="section animate" style="--i: 2; margin-bottom: 1.5rem">
      <div class="section-label">Coverage</div>
      <div class="progress"><div class="progress__fill" style="width: ${pct}%"></div></div>
      <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.25rem">
        ${data.coverage.withExecMemory} of ${data.coverage.totalTasks} tasks have execution memories
      </p>
    </div>

    <div class="timeline">
      ${timelineEntries}
    </div>

    ${flowDef ? `
      <div class="section animate" style="--i: ${data.insights.length + 3}; margin-top: 1.5rem">
        <div class="section-label">Knowledge Flow</div>
        <div class="mermaid-wrap">
          <div class="zoom-controls">
            <button data-zoom-in title="Zoom in">+</button>
            <button data-zoom-out title="Zoom out">&minus;</button>
            <button data-zoom-reset title="Reset">&#8634;</button>
          </div>
          <pre class="mermaid">${flowDef}</pre>
        </div>
      </div>
    ` : ''}

    ${doctrineTable(data)}
  `;

  return {
    bodyHtml,
    extraHead: flowDef ? MERMAID_CDN : undefined,
    extraScripts: flowDef ? ZOOM_CONTROLS_SCRIPT : undefined,
  };
};
