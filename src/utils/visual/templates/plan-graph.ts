import type { TemplateRenderer, PlanGraphData } from '../types.ts';
import { escapeHtml, sanitizeMermaidLabel } from '../renderer.ts';
import { MERMAID_CDN, ZOOM_CONTROLS_SCRIPT, ZOOM_CONTROLS_HTML } from '../css.ts';

const STATUS_SHAPES: Record<string, (id: string, label: string) => string> = {
  pending:  (id, l) => `${id}[${l}]`,
  claimed:  (id, l) => `${id}([${l}])`,
  done:     (id, l) => `${id}{{${l}}}`,
  blocked:  (id, l) => `${id}[/${l}\\]`,
  review:   (id, l) => `${id}[[${l}]]`,
  revision: (id, l) => `${id}((${l}))`,
};

const STATUS_CLASSES: Record<string, string> = {
  pending:  ':::pending',
  claimed:  ':::claimed',
  done:     ':::done',
  blocked:  ':::blocked',
  review:   ':::review',
  revision: ':::revision',
};

function buildMermaid(data: PlanGraphData): string {
  if (data.tasks.length === 0) return '';

  const lines = ['flowchart TD'];

  lines.push('  classDef pending fill:#9ca3af20,stroke:#9ca3af');
  lines.push('  classDef claimed fill:#3b82f620,stroke:#3b82f6');
  lines.push('  classDef done fill:#10b98120,stroke:#10b981');
  lines.push('  classDef blocked fill:#ef444420,stroke:#ef4444');
  lines.push('  classDef review fill:#8b5cf620,stroke:#8b5cf6');
  lines.push('  classDef revision fill:#f59e0b20,stroke:#f59e0b');

  for (const task of data.tasks) {
    const label = sanitizeMermaidLabel(task.name || task.folder);
    const shapeFn = STATUS_SHAPES[task.status] ?? STATUS_SHAPES.pending;
    const cls = STATUS_CLASSES[task.status] ?? '';
    lines.push(`  ${shapeFn(task.folder, label)}${cls}`);
  }

  for (const task of data.tasks) {
    for (const dep of task.dependsOn) {
      lines.push(`  ${dep} --> ${task.folder}`);
    }
  }

  return lines.join('\n');
}

function buildStatusTable(data: PlanGraphData): string {
  if (data.tasks.length === 0) return '';

  const rows = data.tasks.map((t, i) => `
    <tr class="animate" style="--i: ${i + data.tasks.length}">
      <td><code>${escapeHtml(t.folder)}</code></td>
      <td>${escapeHtml(t.name || t.folder)}</td>
      <td><span class="badge badge--${t.status}">${t.status}</span></td>
      <td>${t.claimedBy ? escapeHtml(t.claimedBy) : '<span style="color:var(--text-dim)">--</span>'}</td>
      <td>${t.summary ? escapeHtml(t.summary) : '<span style="color:var(--text-dim)">--</span>'}</td>
    </tr>
  `).join('');

  return `
    <div class="table-wrap" style="margin-top: 2rem">
      <table>
        <thead>
          <tr><th>ID</th><th>Task</th><th>Status</th><th>Claimed By</th><th>Summary</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export const renderPlanGraph: TemplateRenderer<PlanGraphData> = (input) => {
  const { data } = input;
  const mermaidDef = buildMermaid(data);

  let bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">${escapeHtml(data.feature)} -- task dependency graph</p>
  `;

  if (!data.planContent) {
    bodyHtml += `<div class="section section--orange animate" style="--i: 0; margin-bottom: 1rem">
      <div class="section-label">Notice</div>
      <p>No plan found -- showing task graph only.</p>
    </div>`;
  }

  if (data.tasks.length === 0) {
    bodyHtml += `<div class="placeholder">No tasks found for this feature.</div>`;
  } else {
    bodyHtml += `
      <div class="mermaid-wrap animate" style="--i: 1">
        ${ZOOM_CONTROLS_HTML}
        <pre class="mermaid">${mermaidDef}</pre>
      </div>
      ${buildStatusTable(data)}
    `;
  }

  return {
    bodyHtml,
    extraHead: MERMAID_CDN,
    extraScripts: ZOOM_CONTROLS_SCRIPT,
  };
};
