import type { TemplateRenderer, StateFlowData } from '../types.ts';
import { escapeHtml, safeStringify } from '../renderer.ts';

function diffJson(prev: Record<string, unknown>, next: Record<string, unknown>): string {
  const prevLines = safeStringify(prev).split('\n');
  const nextLines = safeStringify(next).split('\n');

  const maxLen = Math.max(prevLines.length, nextLines.length);
  const lines: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const p = prevLines[i];
    const n = nextLines[i];

    if (p === n) {
      lines.push(`<div style="font-family: var(--font-mono); font-size: 0.75rem">  ${escapeHtml(p ?? '')}</div>`);
    } else if (p !== undefined && n !== undefined) {
      lines.push(`<div class="diff-line--removed" style="font-family: var(--font-mono); font-size: 0.75rem">- ${escapeHtml(p)}</div>`);
      lines.push(`<div class="diff-line--added" style="font-family: var(--font-mono); font-size: 0.75rem">+ ${escapeHtml(n)}</div>`);
    } else if (p !== undefined) {
      lines.push(`<div class="diff-line--removed" style="font-family: var(--font-mono); font-size: 0.75rem">- ${escapeHtml(p)}</div>`);
    } else if (n !== undefined) {
      lines.push(`<div class="diff-line--added" style="font-family: var(--font-mono); font-size: 0.75rem">+ ${escapeHtml(n)}</div>`);
    }
  }

  return lines.join('');
}

export const renderStateFlow: TemplateRenderer<StateFlowData> = (input) => {
  const { data } = input;

  if (data.timeline.length === 0) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">State Flow</p>
        <div class="placeholder">No data available.</div>
      `,
    };
  }

  // Collect unique actions for filter
  const actions = [...new Set(data.timeline.map(e => e.action))];

  const entries = data.timeline.map((entry, i) => `
    <div class="timeline__entry animate" style="--i: ${i + 1}" data-action="${escapeHtml(entry.action)}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem">
        <strong>${escapeHtml(entry.action)}</strong>
        <span style="font-size: 0.75rem; color: var(--text-dim)">${escapeHtml(entry.timestamp)}</span>
      </div>
      ${entry.source ? `<span class="badge badge--claimed">${escapeHtml(entry.source)}</span>` : ''}
      <details style="margin-top: 0.5rem">
        <summary style="font-size: 0.75rem; color: var(--text-dim); cursor: pointer">State diff</summary>
        <div style="margin-top: 0.25rem; padding: 0.5rem; background: var(--surface2); border-radius: 4px; overflow-x: auto">
          ${diffJson(entry.prevState, entry.nextState)}
        </div>
      </details>
    </div>
  `).join('');

  const filterButtons = actions.map(a =>
    `<button data-filter-action="${escapeHtml(a)}" style="margin: 0.125rem" class="badge">${escapeHtml(a)}</button>`
  ).join('');

  const bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">${data.timeline.length} state mutations</p>

    <div class="section animate" style="--i: 0; margin-bottom: 1rem" id="filter-bar">
      <div class="section-label">Filter by action</div>
      <button data-filter-action="" style="margin: 0.125rem" class="badge badge--done">All</button>
      ${filterButtons}
    </div>

    <div class="timeline" id="timeline">
      ${entries}
    </div>
  `;

  const filterScript = `
    document.getElementById('filter-bar').addEventListener('click', function(e) {
      var btn = e.target.closest('[data-filter-action]');
      if (!btn) return;
      var action = btn.dataset.filterAction;
      document.querySelectorAll('#timeline .timeline__entry').forEach(function(el) {
        if (!action || el.dataset.action === action) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      });
    });
  `;

  return { bodyHtml, extraScripts: filterScript };
};
