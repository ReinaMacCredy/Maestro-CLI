import type { TemplateRenderer, StatusDashboardData } from '../types.ts';
import { escapeHtml } from '../renderer.ts';

function statusBadge(status: string): string {
  return `<span class="badge badge--${status}">${status}</span>`;
}

export const renderStatusDashboard: TemplateRenderer<StatusDashboardData> = (input) => {
  const { data } = input;
  const f = data.feature;
  const t = data.tasks;
  const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;

  const kpis = [
    { value: t.total, label: 'Total', color: '' },
    { value: t.pending, label: 'Pending', color: 'var(--status-pending)' },
    { value: t.claimed, label: 'In Progress', color: 'var(--status-claimed)' },
    { value: t.done, label: 'Done', color: 'var(--status-done)' },
    { value: t.blocked, label: 'Blocked', color: 'var(--status-blocked)' },
    { value: t.review, label: 'Review', color: 'var(--status-review)' },
    { value: t.revision, label: 'Revision', color: 'var(--status-revision)' },
  ];

  const kpiCards = kpis.map((k, i) => `
    <div class="kpi animate" style="--i: ${i + 2}">
      <div class="kpi__value" ${k.color ? `style="color: ${k.color}"` : ''}>${k.value}</div>
      <div class="kpi__label">${k.label}</div>
    </div>
  `).join('');

  const runnableList = data.runnable.length > 0
    ? `<ul>${data.runnable.map(r => `<li><code>${escapeHtml(r)}</code></li>`).join('')}</ul>`
    : '<p style="color:var(--text-dim)">None</p>';

  const blockedList = data.blocked.length > 0
    ? `<ul>${data.blocked.map(b => `<li><code>${escapeHtml(b)}</code></li>`).join('')}</ul>`
    : '<p style="color:var(--text-dim)">None</p>';

  const doctrineSection = data.doctrineStats.total === 0
    ? '<p style="color:var(--text-dim)">Not configured</p>'
    : `<p>${data.doctrineStats.active} active, ${data.doctrineStats.deprecated} deprecated</p>`;

  const bodyHtml = `
    <h1>${escapeHtml(f.name)}</h1>
    <p class="subtitle">
      ${statusBadge(f.status)} &middot; Stage: ${escapeHtml(data.pipelineStage)}
      ${f.createdAt ? ` &middot; Created ${escapeHtml(f.createdAt.slice(0, 10))}` : ''}
      ${f.approvedAt ? ` &middot; Approved ${escapeHtml(f.approvedAt.slice(0, 10))}` : ''}
      ${f.completedAt ? ` &middot; Completed ${escapeHtml(f.completedAt.slice(0, 10))}` : ''}
    </p>

    <div class="section section--hero animate" style="--i: 0; margin-bottom: 1.5rem">
      <div class="section-label">Progress</div>
      <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem">${pct}%</div>
      <div class="progress"><div class="progress__fill" style="width: ${pct}%"></div></div>
      <p style="margin-top: 0.5rem; color: var(--text-dim); font-size: 0.875rem">${t.done} of ${t.total} tasks complete</p>
    </div>

    <div class="grid" style="margin-bottom: 1.5rem">
      ${kpiCards}
    </div>

    <div class="grid--2 grid" style="margin-bottom: 1.5rem">
      <div class="section section--green animate" style="--i: ${kpis.length + 2}">
        <div class="section-label">Runnable Tasks</div>
        ${runnableList}
      </div>
      <div class="section section--red animate" style="--i: ${kpis.length + 3}">
        <div class="section-label">Blocked Tasks</div>
        ${blockedList}
      </div>
    </div>

    <div class="grid--2 grid" style="margin-bottom: 1.5rem">
      <div class="section animate" style="--i: ${kpis.length + 4}">
        <div class="section-label">Memory</div>
        <p>${data.memoryStats.count} files &middot; ${(data.memoryStats.totalBytes / 1024).toFixed(1)} KB</p>
      </div>
      <div class="section animate" style="--i: ${kpis.length + 5}">
        <div class="section-label">Doctrine</div>
        ${doctrineSection}
      </div>
    </div>

    ${data.nextAction ? `
      <div class="section section--accent animate" style="--i: ${kpis.length + 6}">
        <div class="section-label">Next Action</div>
        <p>${escapeHtml(data.nextAction)}</p>
      </div>
    ` : ''}
  `;

  return { bodyHtml };
};
