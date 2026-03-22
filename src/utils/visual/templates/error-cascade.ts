/**
 * Error Cascade: Tree of errors with boundary annotations.
 * Caught vs uncaught distinction, collapsible stack traces.
 */

import type { TemplateRenderer, ErrorCascadeData, ErrorCascadeEntry } from '../types.ts';
import { escapeHtml } from '../renderer.ts';

function renderError(error: ErrorCascadeEntry, allErrors: Map<string, ErrorCascadeEntry>, depth: number): string {
  const children = (error.children ?? [])
    .map(id => allErrors.get(id))
    .filter((e): e is ErrorCascadeEntry => e !== undefined);

  const borderColor = error.caught ? 'var(--secondary)' : 'var(--danger)';
  const bgColor = error.caught ? 'var(--secondary-dim)' : 'var(--danger-dim)';
  const caughtBadge = error.caught
    ? '<span class="badge badge--done">caught</span>'
    : '<span class="badge badge--blocked">uncaught</span>';

  const boundaryBadge = error.boundary
    ? ` <span class="badge badge--revision">${escapeHtml(error.boundary)}</span>`
    : '';

  const stackHtml = error.stack
    ? `<details style="margin-top: 0.5rem"><summary style="font-size: 0.75rem; color: var(--text-dim); cursor: pointer">Stack trace</summary><pre style="font-family: var(--font-mono); font-size: 0.6875rem; margin-top: 0.25rem; padding: 0.5rem; background: var(--surface2); border-radius: 4px; overflow-x: auto; white-space: pre-wrap">${escapeHtml(error.stack)}</pre></details>`
    : '';

  const childrenHtml = children.length > 0
    ? `<div style="margin-top: 0.5rem; padding-left: 1rem; border-left: 2px solid ${borderColor}">${children.map(c => renderError(c, allErrors, depth + 1)).join('')}</div>`
    : '';

  return `
    <div class="animate" style="--i: ${depth}; margin-bottom: 0.75rem; padding: 0.75rem; background: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: 6px">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem">
        ${caughtBadge}${boundaryBadge}
      </div>
      <div style="font-weight: 600">${escapeHtml(error.message)}</div>
      ${stackHtml}
      ${childrenHtml}
    </div>
  `;
}

export const renderErrorCascade: TemplateRenderer<ErrorCascadeData> = (input) => {
  const { data } = input;

  if (data.errors.length === 0) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">Error Cascade</p>
        <div class="placeholder">No data available.</div>
      `,
    };
  }

  const errorMap = new Map(data.errors.map(e => [e.id, e]));
  const childIds = new Set(data.errors.flatMap(e => e.children ?? []));
  const roots = data.errors.filter(e => !childIds.has(e.id));

  const caught = data.errors.filter(e => e.caught).length;
  const uncaught = data.errors.length - caught;

  const bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">${data.errors.length} errors (${caught} caught, ${uncaught} uncaught)</p>

    <div class="grid" style="margin-bottom: 1.5rem">
      <div class="kpi animate" style="--i: 0">
        <div class="kpi__value">${data.errors.length}</div>
        <div class="kpi__label">Total Errors</div>
      </div>
      <div class="kpi animate" style="--i: 1">
        <div class="kpi__value" style="color: var(--secondary)">${caught}</div>
        <div class="kpi__label">Caught</div>
      </div>
      <div class="kpi animate" style="--i: 2">
        <div class="kpi__value" style="color: var(--danger)">${uncaught}</div>
        <div class="kpi__label">Uncaught</div>
      </div>
    </div>

    <div class="section animate" style="--i: 3">
      ${roots.map(r => renderError(r, errorMap, 0)).join('')}
    </div>
  `;

  return { bodyHtml };
};
