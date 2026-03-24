---
name: maestro:visual
description: "Create interactive HTML visualizations of maestro state and debug data"
argument-hint: "<visualization type or description>"
stage: execution
audience: both
---

# maestro:visual

Render maestro state or debug data as self-contained interactive HTML files. All visualizations support dark/light mode, open in any browser, and require no build step.

## MCP Tools

### `maestro_visual` -- Maestro State Visualizations

Renders data gathered from maestro services. Requires an active feature.

```
maestro_visual({ type: "plan-graph", feature: "my-feature" })
maestro_visual({ type: "status-dashboard" })  // uses active feature
```

| Type | What it shows |
|------|--------------|
| `plan-graph` | Mermaid flowchart of task dependencies. Node shapes encode status (pending/claimed/done/blocked/review/revision). |
| `status-dashboard` | KPI cards (task counts per status), progress bar, runnable/blocked lists, memory + doctrine stats. |
| `memory-map` | Grid of memory cards color-coded by category, sized by priority. Mermaid pie chart for category distribution. |
| `execution-timeline` | Timeline of completed tasks with execution insights. Knowledge flow graph. Doctrine effectiveness table. |
| `doctrine-network` | Mermaid graph of doctrine items connected by shared tags. Effectiveness metrics table. |

### `maestro_debug_visual` -- Debug Visualizations

Renders agent-provided structured data. No feature context needed.

```
maestro_debug_visual({
  type: "component-tree",
  data: { nodes: [...] },
  title: "React Component Hierarchy"
})
```

| Type | What it shows |
|------|--------------|
| `component-tree` | Recursive tree with expand/collapse. Error boundaries highlighted. Props viewable. |
| `state-flow` | Timeline of state mutations with inline JSON diff. Filterable by action. |
| `error-cascade` | Error tree with caught/uncaught distinction. Collapsible stack traces. |
| `network-waterfall` | Chrome DevTools-style waterfall of HTTP requests. Color-coded by status. |
| `dom-diff` | Side-by-side panels with line-by-line diff highlighting. |
| `console-timeline` | Log entries with severity coloring. Level filter controls. |

## CLI Commands

```bash
maestro visual plan-graph --feature my-feature
maestro visual status-dashboard
maestro debug-visual component-tree --data '{"nodes":[...]}'
maestro debug-visual network-waterfall --data /path/to/data.json --no-open
```

## When to Use Which Type

- **Understanding the plan**: `plan-graph` shows task dependencies at a glance
- **Progress check**: `status-dashboard` gives a quick KPI overview
- **Knowledge audit**: `memory-map` shows what the project remembers
- **Post-mortem**: `execution-timeline` traces what happened across tasks
- **Process improvement**: `doctrine-network` shows which rules are effective
- **Debugging UI**: `component-tree` + `error-cascade` for React/Vue issues
- **Debugging state**: `state-flow` for tracking down mutation bugs
- **Debugging network**: `network-waterfall` for API timing issues
- **Visual regression**: `dom-diff` for expected vs actual markup
- **Log analysis**: `console-timeline` for filtering through log noise

## Output

All files are written to `~/.maestro/visuals/` with descriptive filenames. Files auto-rotate at 100 (oldest are pruned). Browser opens automatically unless `--no-open` or `autoOpen: false`.

## CSS Customization

The visual system uses CSS custom properties for theming. For advanced customization, load the `visual-explainer` skill which documents the full CSS pattern library (section cards, grid layouts, animations, depth tiers).
