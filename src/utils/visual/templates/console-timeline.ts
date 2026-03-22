import type { TemplateRenderer, ConsoleTimelineData } from '../types.ts';
import { escapeHtml } from '../renderer.ts';

const LEVEL_COLORS: Record<string, string> = {
  error: 'var(--danger)',
  warn: 'var(--tertiary)',
  info: 'var(--primary)',
  debug: 'var(--text-dim)',
  log: 'var(--text)',
};

export const renderConsoleTimeline: TemplateRenderer<ConsoleTimelineData> = (input) => {
  const { data } = input;

  if (data.entries.length === 0) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">Console Timeline</p>
        <div class="placeholder">No data available.</div>
      `,
    };
  }

  const levels = [...new Set(data.entries.map(e => e.level))];
  const levelCounts = levels.map(l => ({
    level: l,
    count: data.entries.filter(e => e.level === l).length,
  }));

  const filterCheckboxes = levelCounts.map(({ level, count }) => `
    <label style="display: inline-flex; align-items: center; gap: 0.25rem; margin: 0.125rem 0.5rem 0.125rem 0; cursor: pointer; font-size: 0.8125rem">
      <input type="checkbox" checked onchange="toggleLevel('${level}', this.checked)">
      <span style="color: ${LEVEL_COLORS[level] ?? 'var(--text)'}">${level}</span>
      <span style="color: var(--text-dim); font-size: 0.75rem">(${count})</span>
    </label>
  `).join('');

  const entries = data.entries.map((entry, i) => {
    const levelClass = entry.level === 'warn' ? ' console-entry--warn'
      : entry.level === 'error' ? ' console-entry--error'
      : entry.level === 'info' ? ' console-entry--info'
      : entry.level === 'debug' ? ' console-entry--debug'
      : '';

    const dataHtml = entry.data !== undefined
      ? `<details style="margin-top: 0.25rem"><summary style="font-size: 0.6875rem; color: var(--text-dim); cursor: pointer">data</summary><pre style="font-family: var(--font-mono); font-size: 0.6875rem; margin-top: 0.125rem; padding: 0.25rem; background: var(--surface2); border-radius: 4px; overflow-x: auto">${escapeHtml(JSON.stringify(entry.data, null, 2))}</pre></details>`
      : '';

    const sourceBadge = entry.source
      ? `<span class="tag" style="margin-left: auto; flex-shrink: 0">${escapeHtml(entry.source)}</span>`
      : '';

    return `
      <div class="console-entry${levelClass} animate" style="--i: ${i}" data-level="${entry.level}">
        <span class="console-level" style="color: ${LEVEL_COLORS[entry.level] ?? 'var(--text)'}">${entry.level}</span>
        <span style="font-size: 0.6875rem; color: var(--text-dim); flex-shrink: 0">${escapeHtml(entry.timestamp)}</span>
        <span style="flex: 1; min-width: 0">${escapeHtml(entry.message)}${dataHtml}</span>
        ${sourceBadge}
      </div>
    `;
  }).join('');

  const bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">${data.entries.length} log entries</p>

    <div class="section animate" style="--i: 0; margin-bottom: 1rem">
      <div class="section-label">Filter by level</div>
      ${filterCheckboxes}
    </div>

    <div class="section animate" style="--i: 1; padding: 0; overflow: hidden" id="console-container">
      ${entries}
    </div>
  `;

  const filterScript = `
    function toggleLevel(level, show) {
      document.querySelectorAll('#console-container .console-entry').forEach(function(el) {
        if (el.dataset.level === level) {
          el.style.display = show ? '' : 'none';
        }
      });
    }
  `;

  return { bodyHtml, extraScripts: filterScript };
};
