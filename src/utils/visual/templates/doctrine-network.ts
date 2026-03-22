import type { DoctrineStatus } from '../../ports/doctrine.ts';
import type { TemplateRenderer, DoctrineNetworkData } from '../types.ts';
import { escapeHtml, sanitizeMermaidLabel } from '../renderer.ts';
import { MERMAID_CDN, ZOOM_CONTROLS_SCRIPT, ZOOM_CONTROLS_HTML } from '../css.ts';

const DOCTRINE_BADGE: Record<DoctrineStatus, string> = {
  active: 'done',
  deprecated: 'pending',
  proposed: 'review',
};

function buildDoctrineGraph(data: DoctrineNetworkData): string {
  if (data.items.length === 0) return '';

  const lines = ['flowchart TD'];

  lines.push('  classDef active fill:#10b98120,stroke:#10b981');
  lines.push('  classDef deprecated fill:#6b728020,stroke:#6b7280');
  lines.push('  classDef proposed fill:#f59e0b20,stroke:#f59e0b');

  const nodeIds = data.items.map(item => sanitizeMermaidLabel(item.name));

  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    const nodeId = nodeIds[idx];
    lines.push(`  ${nodeId}[${nodeId}]:::${item.status}`);
  }

  const tagToNodes: Record<string, string[]> = {};
  for (let idx = 0; idx < data.items.length; idx++) {
    for (const tag of data.items[idx].tags) {
      const sanitizedTag = sanitizeMermaidLabel(tag);
      if (!tagToNodes[sanitizedTag]) tagToNodes[sanitizedTag] = [];
      tagToNodes[sanitizedTag].push(nodeIds[idx]);
    }
  }

  const addedEdges = new Set<string>();
  const MAX_EDGES_PER_TAG = 15;
  const MAX_TOTAL_EDGES = 200;
  for (const [tag, nodes] of Object.entries(tagToNodes)) {
    if (nodes.length > MAX_EDGES_PER_TAG) continue;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (addedEdges.size >= MAX_TOTAL_EDGES) break;
        const edgeKey = [nodes[i], nodes[j]].sort().join('--');
        if (!addedEdges.has(edgeKey)) {
          addedEdges.add(edgeKey);
          lines.push(`  ${nodes[i]} ---|${tag}| ${nodes[j]}`);
        }
      }
      if (addedEdges.size >= MAX_TOTAL_EDGES) break;
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
      <td><span class="badge badge--${DOCTRINE_BADGE[item.status] ?? 'pending'}">${item.status}</span></td>
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
        ${ZOOM_CONTROLS_HTML}
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
