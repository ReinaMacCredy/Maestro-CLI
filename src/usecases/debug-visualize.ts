/**
 * Debug Visualize use case: validate agent-provided data and render.
 * No service dependencies -- data comes directly from the caller.
 */

import { z } from 'zod';
import type { DebugVisualType, VisualResult, TemplateRenderer } from '../utils/visual/types.ts';
import { renderPage, writeVisual } from '../utils/visual/renderer.ts';
import { renderComponentTree } from '../utils/visual/templates/component-tree.ts';
import { renderStateFlow } from '../utils/visual/templates/state-flow.ts';
import { renderErrorCascade } from '../utils/visual/templates/error-cascade.ts';
import { renderNetworkWaterfall } from '../utils/visual/templates/network-waterfall.ts';
import { renderDomDiff } from '../utils/visual/templates/dom-diff.ts';
import { renderConsoleTimeline } from '../utils/visual/templates/console-timeline.ts';
import { MaestroError } from '../lib/errors.ts';

// ============================================================================
// Zod Schemas
// ============================================================================

const ComponentTreeSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['component', 'element', 'provider', 'fragment']),
    props: z.record(z.unknown()).optional(),
    children: z.array(z.string()).optional(),
    error: z.string().optional(),
    errorBoundary: z.boolean().optional(),
  })),
});

const StateFlowSchema = z.object({
  timeline: z.array(z.object({
    timestamp: z.string(),
    action: z.string(),
    prevState: z.record(z.unknown()),
    nextState: z.record(z.unknown()),
    source: z.string().optional(),
  })),
});

const ErrorCascadeSchema = z.object({
  errors: z.array(z.object({
    id: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    boundary: z.string().optional(),
    caught: z.boolean().optional(),
    children: z.array(z.string()).optional(),
  })),
});

const NetworkWaterfallSchema = z.object({
  requests: z.array(z.object({
    id: z.string(),
    url: z.string(),
    method: z.string(),
    startTime: z.number(),
    endTime: z.number(),
    status: z.number(),
    size: z.number().optional(),
    error: z.string().optional(),
  })),
});

const DomDiffSchema = z.object({
  expected: z.string(),
  actual: z.string(),
  context: z.string().optional(),
});

const ConsoleTimelineSchema = z.object({
  entries: z.array(z.object({
    timestamp: z.string(),
    level: z.enum(['log', 'warn', 'error', 'info', 'debug']),
    message: z.string(),
    data: z.unknown().optional(),
    source: z.string().optional(),
  })),
});

const SCHEMAS: Record<DebugVisualType, z.ZodType> = {
  'component-tree': ComponentTreeSchema,
  'state-flow': StateFlowSchema,
  'error-cascade': ErrorCascadeSchema,
  'network-waterfall': NetworkWaterfallSchema,
  'dom-diff': DomDiffSchema,
  'console-timeline': ConsoleTimelineSchema,
};

// ============================================================================
// Template Dispatch
// ============================================================================

const RENDERERS: Record<DebugVisualType, TemplateRenderer<unknown>> = {
  'component-tree': renderComponentTree,
  'state-flow': renderStateFlow,
  'error-cascade': renderErrorCascade,
  'network-waterfall': renderNetworkWaterfall,
  'dom-diff': renderDomDiff,
  'console-timeline': renderConsoleTimeline,
};

// ============================================================================
// Main
// ============================================================================

export async function debugVisualize(
  type: DebugVisualType,
  data: unknown,
  title?: string,
  autoOpen: boolean = true,
): Promise<VisualResult> {
  // Validate
  const schema = SCHEMAS[type];
  if (!schema) {
    throw new MaestroError(`Unknown debug visualization type: ${type}`);
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new MaestroError(
      `Invalid data for ${type}: ${result.error.message}`,
      ['See maestro skill maestro:visual for schema reference'],
    );
  }

  // Render
  const renderer = RENDERERS[type];
  const pageTitle = title ?? type;
  const generatedAt = new Date().toISOString();
  const output = renderer({ data: result.data, title: pageTitle, generatedAt });

  const html = renderPage({
    title: pageTitle,
    bodyHtml: output.bodyHtml,
    extraHead: output.extraHead,
    extraScripts: output.extraScripts,
  });

  return writeVisual(type, html, undefined, autoOpen);
}
