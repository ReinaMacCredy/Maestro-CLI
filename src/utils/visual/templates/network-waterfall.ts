/**
 * Network Waterfall: Horizontal bars showing request timing.
 * Pure CSS with calc() positioning.
 */

import type { TemplateRenderer, NetworkWaterfallData, NetworkRequest } from '../types.ts';
import { escapeHtml } from '../renderer.ts';

function safeNum(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function statusClass(status: number, error?: string): string {
  if (error) return 'waterfall__bar--error';
  if (status >= 500) return 'waterfall__bar--5xx';
  if (status >= 400) return 'waterfall__bar--4xx';
  return 'waterfall__bar--2xx';
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`.slice(0, 40);
  } catch {
    return url.slice(0, 40);
  }
}

export const renderNetworkWaterfall: TemplateRenderer<NetworkWaterfallData> = (input) => {
  const { data } = input;

  if (data.requests.length === 0) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">Network Waterfall</p>
        <div class="placeholder">No data available.</div>
      `,
    };
  }

  const minTime = Math.min(...data.requests.map(r => safeNum(r.startTime)));
  const maxTime = Math.max(...data.requests.map(r => safeNum(r.endTime)));
  const totalDuration = maxTime - minTime || 1;

  const rows = data.requests.map((req, i) => {
    const start = safeNum(req.startTime);
    const end = safeNum(req.endTime);
    const invalid = start >= end || !Number.isFinite(req.startTime) || !Number.isFinite(req.endTime);

    const leftPct = invalid ? 0 : ((start - minTime) / totalDuration) * 100;
    const widthPct = invalid ? 2 : Math.max(((end - start) / totalDuration) * 100, 0.5);
    const duration = invalid ? '[invalid timing]' : `${(end - start).toFixed(0)}ms`;
    const sizeLabel = formatSize(req.size);
    const cls = statusClass(req.status, req.error);

    return `
      <div class="waterfall__row animate" style="--i: ${i + 1}">
        <div class="waterfall__label" title="${escapeHtml(req.url)}">
          <span style="font-weight: 600; margin-right: 0.25rem">${escapeHtml(req.method)}</span>
          ${escapeHtml(shortenUrl(req.url))}
        </div>
        <div class="waterfall__track">
          <div class="${cls}" style="left: ${leftPct}%; width: ${widthPct}%" class="waterfall__bar ${cls}">
            ${duration}${sizeLabel ? ` / ${sizeLabel}` : ''}
          </div>
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.6875rem; width: 3rem; text-align: right; flex-shrink: 0; color: ${req.status >= 400 ? 'var(--danger)' : 'var(--text-dim)'}">
          ${req.error ? 'ERR' : req.status}
        </div>
      </div>
    `;
  }).join('');

  const errors = data.requests.filter(r => r.error || r.status >= 400);
  const totalTime = (maxTime - minTime).toFixed(0);

  const bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">${data.requests.length} requests &middot; ${totalTime}ms total</p>

    <div class="grid" style="margin-bottom: 1.5rem">
      <div class="kpi animate" style="--i: 0">
        <div class="kpi__value">${data.requests.length}</div>
        <div class="kpi__label">Requests</div>
      </div>
      <div class="kpi animate" style="--i: 0">
        <div class="kpi__value" style="color: ${errors.length > 0 ? 'var(--danger)' : 'var(--secondary)'}">${errors.length}</div>
        <div class="kpi__label">Errors</div>
      </div>
      <div class="kpi animate" style="--i: 0">
        <div class="kpi__value">${totalTime}ms</div>
        <div class="kpi__label">Duration</div>
      </div>
    </div>

    <div class="section animate" style="--i: 1">
      <div class="waterfall">
        ${rows}
      </div>
    </div>
  `;

  return { bodyHtml };
};
