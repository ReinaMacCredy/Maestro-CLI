# Maestro Visual CSS Patterns

Maestro-specific CSS additions built on the visual-explainer foundation.

## Task Status Colors

```
--status-pending:  #9ca3af  (grey)
--status-claimed:  #3b82f6  (blue)
--status-done:     #10b981  (green)
--status-blocked:  #ef4444  (red)
--status-review:   #8b5cf6  (purple)
--status-revision: #f59e0b  (amber)
```

Use with `.badge--{status}` classes for consistent badges.

## Memory Category Colors

```
--cat-decision:     #3b82f6  (blue)
--cat-research:     #10b981  (green)
--cat-architecture: #8b5cf6  (purple)
--cat-convention:   #14b8a6  (teal)
--cat-debug:        #f97316  (orange)
--cat-execution:    #6b8e6b  (sage)
```

## Pipeline Stage Badges

Use `.badge` with inline `style="background: var(--status-X)"` for pipeline stage indicators.

## Mermaid Node Shapes

Each task status maps to a distinct Mermaid flowchart shape:

| Status | Shape | Syntax |
|--------|-------|--------|
| pending | rectangle | `id[text]` |
| claimed | stadium | `id([text])` |
| done | hexagon | `id{{text}}` |
| blocked | trapezoid | `id[/text\]` |
| review | subroutine | `id[[text]]` |
| revision | circle | `id((text))` |

## Base CSS Reference

For the full CSS pattern library (section cards, grid layouts, animations, depth tiers, tables, responsive patterns), load the `visual-explainer` skill.
