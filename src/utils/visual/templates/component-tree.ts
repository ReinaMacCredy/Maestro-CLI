/**
 * Component Tree: Recursive tree with expand/collapse.
 * Error boundaries highlighted, props on click.
 */

import type { TemplateRenderer, ComponentTreeData, ComponentTreeNode } from '../types.ts';
import { escapeHtml } from '../renderer.ts';

function renderNode(node: ComponentTreeNode, allNodes: Map<string, ComponentTreeNode>, depth: number): string {
  const children = (node.children ?? [])
    .map(id => allNodes.get(id))
    .filter((n): n is ComponentTreeNode => n !== undefined);

  const hasChildren = children.length > 0;
  const errorClass = node.error ? ' tree-node--error' : (node.errorBoundary ? ' tree-node--boundary' : '');
  const typeLabel = node.type !== 'component' ? ` <span style="color:var(--text-dim); font-size: 0.75rem">[${node.type}]</span>` : '';

  const propsHtml = node.props && Object.keys(node.props).length > 0
    ? `<details style="margin-top: 0.25rem"><summary style="font-size: 0.75rem; color: var(--text-dim); cursor: pointer">props</summary><pre style="font-family: var(--font-mono); font-size: 0.75rem; margin-top: 0.25rem; padding: 0.5rem; background: var(--surface2); border-radius: 4px; overflow-x: auto">${escapeHtml(JSON.stringify(node.props, null, 2))}</pre></details>`
    : '';

  const errorHtml = node.error
    ? `<div style="font-size: 0.75rem; color: var(--danger); margin-top: 0.25rem">${escapeHtml(node.error)}</div>`
    : '';

  const boundaryBadge = node.errorBoundary
    ? ' <span class="badge badge--revision">boundary</span>'
    : '';

  const childrenHtml = hasChildren
    ? `<ul class="tree">${children.map(c => `<li>${renderNode(c, allNodes, depth + 1)}</li>`).join('')}</ul>`
    : '';

  if (hasChildren) {
    return `
      <details ${depth < 3 ? 'open' : ''}>
        <summary class="tree-node${errorClass}" style="cursor: pointer">
          <strong>${escapeHtml(node.name)}</strong>${typeLabel}${boundaryBadge}
        </summary>
        ${errorHtml}${propsHtml}${childrenHtml}
      </details>
    `;
  }

  return `
    <div class="tree-node${errorClass}">
      <strong>${escapeHtml(node.name)}</strong>${typeLabel}${boundaryBadge}
      ${errorHtml}${propsHtml}
    </div>
  `;
}

export const renderComponentTree: TemplateRenderer<ComponentTreeData> = (input) => {
  const { data } = input;

  if (data.nodes.length === 0) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">Component Tree</p>
        <div class="placeholder">No data available.</div>
      `,
    };
  }

  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  const childIds = new Set(data.nodes.flatMap(n => n.children ?? []));
  const roots = data.nodes.filter(n => !childIds.has(n.id));

  const treeHtml = roots.length > 0
    ? `<ul class="tree">${roots.map(r => `<li>${renderNode(r, nodeMap, 0)}</li>`).join('')}</ul>`
    : `<ul class="tree">${data.nodes.map(n => `<li>${renderNode(n, nodeMap, 0)}</li>`).join('')}</ul>`;

  return {
    bodyHtml: `
      <h1>${escapeHtml(input.title)}</h1>
      <p class="subtitle">${data.nodes.length} components</p>
      <div class="section animate" style="--i: 0">
        ${treeHtml}
      </div>
    `,
  };
};
