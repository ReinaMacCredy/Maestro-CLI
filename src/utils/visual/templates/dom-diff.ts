import type { TemplateRenderer, DomDiffData } from '../types.ts';
import { escapeHtml } from '../renderer.ts';

function diffLines(expected: string, actual: string): { expectedHtml: string; actualHtml: string } {
  const expLines = expected.split('\n');
  const actLines = actual.split('\n');
  const maxLen = Math.max(expLines.length, actLines.length);

  const expResult: string[] = [];
  const actResult: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const e = expLines[i];
    const a = actLines[i];

    if (e === a) {
      expResult.push(`<div>${escapeHtml(e ?? '')}</div>`);
      actResult.push(`<div>${escapeHtml(a ?? '')}</div>`);
    } else if (e !== undefined && a !== undefined) {
      expResult.push(`<div class="diff-line--removed">${escapeHtml(e)}</div>`);
      actResult.push(`<div class="diff-line--added">${escapeHtml(a)}</div>`);
    } else if (e !== undefined) {
      expResult.push(`<div class="diff-line--removed">${escapeHtml(e)}</div>`);
      actResult.push(`<div style="opacity: 0.3">&nbsp;</div>`);
    } else if (a !== undefined) {
      expResult.push(`<div style="opacity: 0.3">&nbsp;</div>`);
      actResult.push(`<div class="diff-line--added">${escapeHtml(a)}</div>`);
    }
  }

  return { expectedHtml: expResult.join(''), actualHtml: actResult.join('') };
}

export const renderDomDiff: TemplateRenderer<DomDiffData> = (input) => {
  const { data } = input;

  if (!data.expected && !data.actual) {
    return {
      bodyHtml: `
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtitle">DOM Diff</p>
        <div class="placeholder">No data available.</div>
      `,
    };
  }

  const { expectedHtml, actualHtml } = diffLines(data.expected, data.actual);

  const expLineCount = data.expected.split('\n').length;
  const actLineCount = data.actual.split('\n').length;

  const bodyHtml = `
    <h1>${escapeHtml(input.title)}</h1>
    <p class="subtitle">DOM Diff${data.context ? ` -- ${escapeHtml(data.context)}` : ''}</p>

    <div class="diff-panel animate" style="--i: 0">
      <div>
        <div class="section-label" style="margin-bottom: 0.5rem">Expected (${expLineCount} lines)</div>
        <div class="diff-side">${expectedHtml}</div>
      </div>
      <div>
        <div class="section-label" style="margin-bottom: 0.5rem">Actual (${actLineCount} lines)</div>
        <div class="diff-side">${actualHtml}</div>
      </div>
    </div>
  `;

  return { bodyHtml };
};
