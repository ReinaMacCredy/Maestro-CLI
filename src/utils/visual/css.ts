export const MAESTRO_CSS = `
/* ========================================================================
   Theme: Custom Properties (light default, dark via media query)
   ======================================================================== */

:root {
  --bg: #fafafa;
  --surface: #ffffff;
  --surface2: #f5f5f5;
  --surface-elevated: #ffffff;
  --border: rgba(0, 0, 0, 0.08);
  --border-bright: rgba(0, 0, 0, 0.15);
  --text: #1a1a2e;
  --text-dim: #6b7280;
  --accent: #7c3aed;
  --accent-dim: rgba(124, 58, 237, 0.08);
  --primary: #2563eb;
  --primary-dim: rgba(37, 99, 235, 0.08);
  --secondary: #059669;
  --secondary-dim: rgba(5, 150, 105, 0.08);
  --tertiary: #d97706;
  --tertiary-dim: rgba(217, 119, 6, 0.08);
  --danger: #dc2626;
  --danger-dim: rgba(220, 38, 38, 0.08);

  /* Task status colors */
  --status-pending: #9ca3af;
  --status-claimed: #3b82f6;
  --status-done: #10b981;
  --status-blocked: #ef4444;
  --status-review: #8b5cf6;
  --status-revision: #f59e0b;

  /* Memory category colors */
  --cat-decision: #3b82f6;
  --cat-research: #10b981;
  --cat-architecture: #8b5cf6;
  --cat-convention: #14b8a6;
  --cat-debug: #f97316;
  --cat-execution: #6b8e6b;

  /* Fonts */
  --font-body: 'Outfit', system-ui, -apple-system, sans-serif;
  --font-mono: 'Space Mono', 'SF Mono', Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --surface2: #1c2333;
    --surface-elevated: #21262d;
    --border: rgba(255, 255, 255, 0.08);
    --border-bright: rgba(255, 255, 255, 0.15);
    --text: #e6edf3;
    --text-dim: #8b949e;
    --accent: #a78bfa;
    --accent-dim: rgba(167, 139, 250, 0.12);
    --primary: #58a6ff;
    --primary-dim: rgba(88, 166, 255, 0.12);
    --secondary: #3fb950;
    --secondary-dim: rgba(63, 185, 80, 0.12);
    --tertiary: #d29922;
    --tertiary-dim: rgba(210, 153, 34, 0.12);
    --danger: #f85149;
    --danger-dim: rgba(248, 81, 73, 0.12);

    --status-pending: #6b7280;
    --status-claimed: #58a6ff;
    --status-done: #3fb950;
    --status-blocked: #f85149;
    --status-review: #a78bfa;
    --status-revision: #d29922;

    --cat-decision: #58a6ff;
    --cat-research: #3fb950;
    --cat-architecture: #a78bfa;
    --cat-convention: #2dd4bf;
    --cat-debug: #fb923c;
    --cat-execution: #86a886;
  }
}

/* ========================================================================
   Base
   ======================================================================== */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  overflow-wrap: break-word;
  -webkit-font-smoothing: antialiased;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.subtitle {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 2rem;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ========================================================================
   Section Cards
   ======================================================================== */

.section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  min-width: 0;
}

.section--hero {
  background: var(--accent-dim);
  border-color: var(--accent);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
}

.section--accent { border-left: 3px solid var(--accent); }
.section--green { border-left: 3px solid var(--secondary); }
.section--orange { border-left: 3px solid var(--tertiary); }
.section--red { border-left: 3px solid var(--danger); }
.section--blue { border-left: 3px solid var(--primary); }

.section-label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.section-label::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

/* ========================================================================
   Grid Layout
   ======================================================================== */

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.grid--2 { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }

/* ========================================================================
   KPI Cards
   ======================================================================== */

.kpi {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
  min-width: 0;
}

.kpi__value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
}

.kpi__label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  margin-top: 0.25rem;
}

/* ========================================================================
   Status Badges
   ======================================================================== */

.badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.badge--pending { background: var(--status-pending); color: #fff; }
.badge--claimed { background: var(--status-claimed); color: #fff; }
.badge--done { background: var(--status-done); color: #fff; }
.badge--blocked { background: var(--status-blocked); color: #fff; }
.badge--review { background: var(--status-review); color: #fff; }
.badge--revision { background: var(--status-revision); color: #fff; }

/* ========================================================================
   Tables
   ======================================================================== */

.table-wrap { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

th {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border-bright);
}

td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

tr:nth-child(even) td { background: var(--surface2); }
tr:hover td { background: var(--accent-dim); }

/* ========================================================================
   Progress Bar
   ======================================================================== */

.progress {
  height: 8px;
  background: var(--surface2);
  border-radius: 4px;
  overflow: hidden;
  margin: 0.5rem 0;
}

.progress__fill {
  height: 100%;
  background: var(--status-done);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* ========================================================================
   Tag Pills
   ======================================================================== */

.tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: var(--accent-dim);
  color: var(--accent);
  margin: 0.125rem;
}

/* ========================================================================
   Placeholder (empty state)
   ======================================================================== */

.placeholder {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-dim);
  font-style: italic;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: 12px;
}

/* ========================================================================
   Mermaid Container
   ======================================================================== */

.mermaid-wrap {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  overflow: auto;
}

.mermaid-wrap .mermaid {
  transition: transform 0.2s ease;
  transform-origin: top center;
}

.zoom-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 2;
}

.zoom-controls button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-controls button:hover { background: var(--accent-dim); }

/* Mermaid theme overrides */
.mermaid .nodeLabel { color: var(--text) !important; font-size: 14px !important; }
.mermaid .edgeLabel { color: var(--text-dim) !important; background-color: var(--bg) !important; font-size: 12px !important; }
.mermaid .edgeLabel rect { fill: var(--bg) !important; }

/* ========================================================================
   Timeline
   ======================================================================== */

.timeline { position: relative; padding-left: 2rem; }

.timeline::before {
  content: '';
  position: absolute;
  left: 0.5rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-bright);
}

.timeline__entry {
  position: relative;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.timeline__entry::before {
  content: '';
  position: absolute;
  left: -1.75rem;
  top: 1rem;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg);
}

/* ========================================================================
   Diff
   ======================================================================== */

.diff-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.diff-side {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.diff-line--added { background: var(--secondary-dim); }
.diff-line--removed { background: var(--danger-dim); }

/* ========================================================================
   Console
   ======================================================================== */

.console-entry {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.console-entry--warn { background: var(--tertiary-dim); }
.console-entry--error { background: var(--danger-dim); }
.console-entry--info { background: var(--primary-dim); }
.console-entry--debug { background: var(--surface2); color: var(--text-dim); }

.console-level {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.625rem;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  width: 3rem;
}

/* ========================================================================
   Tree
   ======================================================================== */

.tree { list-style: none; padding-left: 1.5rem; }
.tree > li { padding-left: 0; }

.tree-node {
  padding: 0.25rem 0.5rem;
  border-left: 2px solid var(--border);
  margin-bottom: 0.25rem;
}

.tree-node--error {
  border-left-color: var(--danger);
  background: var(--danger-dim);
  border-radius: 4px;
}

.tree-node--boundary {
  border-left-color: var(--tertiary);
}

/* ========================================================================
   Waterfall
   ======================================================================== */

.waterfall { position: relative; }

.waterfall__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 28px;
  margin-bottom: 2px;
}

.waterfall__label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  width: 200px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-dim);
}

.waterfall__track {
  flex: 1;
  position: relative;
  height: 20px;
  background: var(--surface2);
  border-radius: 4px;
}

.waterfall__bar {
  position: absolute;
  height: 100%;
  border-radius: 4px;
  min-width: 4px;
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 4px;
  overflow: hidden;
  white-space: nowrap;
}

.waterfall__bar--2xx { background: var(--status-done); }
.waterfall__bar--4xx { background: var(--tertiary); }
.waterfall__bar--5xx { background: var(--danger); }
.waterfall__bar--error { background: var(--danger); }

/* ========================================================================
   Animation
   ======================================================================== */

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate {
  animation: fadeUp 0.4s ease-out both;
  animation-delay: calc(var(--i, 0) * 0.06s);
}

@media (prefers-reduced-motion: reduce) {
  .animate { animation-duration: 0.01ms !important; animation-delay: 0ms !important; }
}

/* ========================================================================
   Footer
   ======================================================================== */

.footer {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-dim);
  text-align: center;
}

/* ========================================================================
   Responsive
   ======================================================================== */

@media (max-width: 768px) {
  .container { padding: 1rem; }
  h1 { font-size: 1.25rem; }
  .grid { grid-template-columns: 1fr; }
  .diff-panel { grid-template-columns: 1fr; }
  .waterfall__label { width: 120px; }
}
`;

export const GOOGLE_FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">`;

export const MERMAID_CDN = `<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
mermaid.initialize({
  startOnLoad: true,
  theme: 'base',
  themeVariables: {
    primaryColor: isDark ? '#2d1b69' : '#ede9fe',
    primaryBorderColor: isDark ? '#7c3aed' : '#8b5cf6',
    primaryTextColor: isDark ? '#e6edf3' : '#1a1a2e',
    secondaryColor: isDark ? '#1c2333' : '#f0fdf4',
    secondaryBorderColor: isDark ? '#059669' : '#16a34a',
    lineColor: isDark ? '#6b7280' : '#9ca3af',
    fontSize: '14px',
  },
});
</script>
<script>
window.addEventListener('error', function(e) {
  if (e.target && e.target.tagName === 'SCRIPT') {
    document.querySelectorAll('.mermaid-wrap').forEach(function(el) {
      el.innerHTML = '<div class="placeholder">Could not load Mermaid from CDN. Check your network connection.</div>';
    });
  }
}, true);
</script>`;

export const ZOOM_CONTROLS_HTML = `<div class="zoom-controls">
  <button data-zoom-in title="Zoom in">+</button>
  <button data-zoom-out title="Zoom out">&minus;</button>
  <button data-zoom-reset title="Reset">&#8634;</button>
</div>`;

export const ZOOM_CONTROLS_SCRIPT = `
document.querySelectorAll('.mermaid-wrap').forEach(function(wrap) {
  var scale = 1;
  var mermaidEl = wrap.querySelector('.mermaid');
  if (!mermaidEl) return;
  var controls = wrap.querySelector('.zoom-controls');
  if (!controls) return;
  controls.querySelector('[data-zoom-in]').addEventListener('click', function() {
    scale = Math.min(scale * 1.2, 3);
    mermaidEl.style.transform = 'scale(' + scale + ')';
  });
  controls.querySelector('[data-zoom-out]').addEventListener('click', function() {
    scale = Math.max(scale * 0.8, 0.3);
    mermaidEl.style.transform = 'scale(' + scale + ')';
  });
  controls.querySelector('[data-zoom-reset]').addEventListener('click', function() {
    scale = 1;
    mermaidEl.style.transform = 'scale(1)';
  });
});
`;
