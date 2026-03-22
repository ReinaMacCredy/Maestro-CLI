/**
 * Doctrine Network: Mermaid graph of doctrine items connected by shared tags.
 * Color by status, detail table with effectiveness metrics.
 */

import type { TemplateRenderer, DoctrineNetworkData } from '../types.ts';
import { escapeHtml, sanitizeMermaidLabel } from '../renderer.ts';
import { MERMAID_CDN, ZOOM_CONTROLS_SCRIPT } from '../css.ts';

function buildDoctrineGraph(data: DoctrineNetworkData): string {
  if (data.items.length === 0) return '';

  const lines = ['flowchart TD'];

  // Class definitions
  lines.push('  classDef active fill:#10b98120,stroke:#10b981');
  lines.push('  classDef deprecated fill:#6b728020,stroke:#6b7280');
  lines.push('  classDef proposed fill:#f59e0b20,stroke:#f59e0b');

  // Nodes
  for (const item of data.items) {
    const label = sanitizeMermaidLabel(item.name);
    const cls = `:::${item.status}`;
    lines.push(`  ${sanitizeMermaidLabel(item.name)}[${label}]${cls}`);
  }

  // Edges: connect items that share tags
  const tagToItems: Record<string, string[]> = {};
  for (const item of data.items) {
    for (const tag of item.tags) {
      if (!tagToItems[tag]) tagToItems[tag] = [];
      tagToItems[tag].push(sanitizeMermaidLabel(item.name));
    }
  }

  const addedEdges = new Set<string>();
  for (const [tag, items] of Object.entries(tagToItems)) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const edgeKey = [items[i], items[j]].sort().join('--');
        if (!addedEdges.has(edgeKey)) {
          addedEdges.add(edgeKey);
          lines.push(`  ${items[i]} ---|${sanitizeMermaidLabel(tag)}| ${items[j]}`);
        }
      }
    }
  }

  return lines.join('\n');
}

export const renderDoctrineNetwork: TemplateRenderer<DoctrineNetworkData> = (input) => {
  const { data } = input;

  if (data.items.length === 0) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">${escapeHtml(data.feature)} -- doctrine network</p>
        <div class="placeholder">No doctrine items found. Run <code>maestro doctrine-write</code> to add items.</div>
      `,
    };
  }

  const graphDef = buildDoctrineGraph(data);

  const rows = data.items.map((item, i) => `
    <tr class="animate" style="--i: ${i + data.items.length + 3}">
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td><span class="badge badge--${item.status === 'active' ? 'done' : item.status === 'deprecated' ? 'pending' : 'revision'}">${item.status}</span></td>
      <td style="max-width: 300px">${escapeHtml(item.rule)}</td>
      <td>${item.effectiveness.injectionCount}</td>
      <td>${(item.effectiveness.associatedSuccessRate * 100).toFixed(0)}%</td>
      <td>${item.effectiveness.overrideCount}</td>
      <td>${item.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">${escapeHtml(data.feature)} -- ${data.items.length} doctrine items</p>

    ${graphDef ? `
      <div class="mermaid-wrap animate" style="--i: 0; margin-bottom: 1.5rem">
        <div class="zoom-controls">
          <button data-zoom-in title="Zoom in">+</button>
          <button data-zoom-out title="Zoom out">&minus;</button>
          <button data-zoom-reset title="Reset">&#8634;</button>
        </div>
        <pre class="mermaid">${graphDef}</pre>
      </div>
    ` : ''}

    <div class="section animate" style="--i: ${data.items.length + 2}">
      <div class="section-label">Doctrine Details</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Status</th><th>Rule</th><th>Injections</th><th>Success</th><th>Overrides</th><th>Tags</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  return {
    bodyHtml,
    extraHead: graphDef ? MERMAID_CDN : undefined,
    extraScripts: graphDef ? ZOOM_CONTROLS_SCRIPT : undefined,
  };
};
