/**
 * Memory Map: Grid of memories color-coded by category.
 * Visual weight by priority, Mermaid pie for category distribution.
 */

import type { TemplateRenderer, MemoryMapData, MemoryMapEntry } from '../types.ts';
import { escapeHtml, sanitizeMermaidLabel } from '../renderer.ts';
import { MERMAID_CDN } from '../css.ts';

const CATEGORY_COLORS: Record<string, string> = {
  decision: 'var(--cat-decision)',
  research: 'var(--cat-research)',
  architecture: 'var(--cat-architecture)',
  convention: 'var(--cat-convention)',
  debug: 'var(--cat-debug)',
  execution: 'var(--cat-execution)',
};

function priorityLabel(p?: number): string {
  if (p === undefined) return '--';
  return `${'P' + p}`;
}

function categoryColor(cat?: string): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'var(--text-dim)') : 'var(--text-dim)';
}

function cardSize(priority?: number): string {
  // 0 = highest priority = largest card
  const p = priority ?? 2;
  const scale = 1 - (p * 0.1);
  return `transform: scale(${scale})`;
}

function buildPieChart(memories: MemoryMapEntry[]): string {
  const counts: Record<string, number> = {};
  for (const m of memories) {
    const cat = m.category ?? 'uncategorized';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  if (Object.keys(counts).length === 0) return '';

  const entries = Object.entries(counts)
    .map(([cat, count]) => `    "${sanitizeMermaidLabel(cat)}" : ${count}`)
    .join('\n');

  return `pie title Category Distribution\n${entries}`;
}

export const renderMemoryMap: TemplateRenderer<MemoryMapData> = (input) => {
  const { data } = input;

  if (data.memories.length === 0) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">${escapeHtml(data.feature)} -- memory map</p>
        <div class="placeholder">No memories found for this feature.</div>
      `,
    };
  }

  const pieDef = buildPieChart(data.memories);

  const cards = data.memories.map((m, i) => `
    <div class="section animate" style="--i: ${i + 2}; border-left: 3px solid ${categoryColor(m.category)}">
      <div class="section-label" style="margin-bottom: 0.5rem">
        <span style="background: ${categoryColor(m.category)}; width: 8px; height: 8px; border-radius: 50%; display: inline-block"></span>
        ${escapeHtml(m.category ?? 'uncategorized')}
      </div>
      <div style="font-weight: 600; margin-bottom: 0.25rem">${escapeHtml(m.name)}</div>
      <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.5rem">
        ${priorityLabel(m.priority)} &middot; ${(m.sizeBytes / 1024).toFixed(1)} KB &middot; ${escapeHtml(m.updatedAt.slice(0, 10))}
      </div>
      <div>
        ${m.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        ${m.tags.length === 0 ? '<span style="color:var(--text-dim); font-size: 0.75rem">no tags</span>' : ''}
      </div>
    </div>
  `).join('');

  const bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">${escapeHtml(data.feature)} -- ${data.memories.length} memories</p>

    ${pieDef ? `
      <div class="mermaid-wrap animate" style="--i: 0; margin-bottom: 1.5rem">
        <pre class="mermaid">${pieDef}</pre>
      </div>
    ` : ''}

    <div class="grid">
      ${cards}
    </div>
  `;

  return {
    bodyHtml,
    extraHead: pieDef ? MERMAID_CDN : undefined,
  };
};
