/**
 * Manifest loader -- reads manifest.json files and detects tool availability.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'node:child_process';
import { isToolAllowed } from '../core/settings.ts';
import type { ToolManifest, ToolStatus } from './types.ts';

// ============================================================================
// Manifest Loading
// ============================================================================

/**
 * Read and validate a single manifest.json file.
 * Returns null if the file doesn't exist or is malformed.
 */
export function loadManifest(filePath: string): ToolManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.name || typeof parsed.priority !== 'number') return null;
    return parsed as ToolManifest;
  } catch {
    return null;
  }
}

/**
 * Scan a toolbox directory for manifest.json files.
 * Expected structure: tools/{built-in,external}/<tool-name>/manifest.json
 */
export function scanToolboxDir(toolboxRoot: string): ToolManifest[] {
  const manifests: ToolManifest[] = [];
  const toolsDir = path.join(toolboxRoot, 'tools');

  for (const category of ['built-in', 'external']) {
    const categoryDir = path.join(toolsDir, category);
    if (!fs.existsSync(categoryDir)) continue;

    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(categoryDir, entry.name, 'manifest.json');
      const manifest = loadManifest(manifestPath);
      if (manifest) manifests.push(manifest);
    }
  }

  return manifests;
}

/**
 * Scan built-in manifests shipped with the package (src/toolbox/tools/).
 */
export function scanBuiltInManifests(): ToolManifest[] {
  const toolboxRoot = path.join(import.meta.dir);
  return scanToolboxDir(toolboxRoot);
}

// ============================================================================
// Detection
// ============================================================================

const detectCache = new Map<string, { installed: boolean; version?: string; error?: string }>();

/**
 * Check if a tool is installed by running its detect command.
 */
export function detectTool(
  manifest: ToolManifest,
  allowDeny: { allow: string[]; deny: string[] },
): ToolStatus {
  const settingsState: ToolStatus['settingsState'] =
    allowDeny.deny.includes(manifest.name)
      ? 'denied'
      : allowDeny.allow.length > 0
        ? allowDeny.allow.includes(manifest.name) ? 'allowed' : 'denied'
        : 'default';

  // No detection needed -- always available
  if (manifest.detect === null && manifest.binary === null) {
    return { manifest, installed: true, settingsState };
  }

  const cacheKey = manifest.detect ?? manifest.binary ?? manifest.name;
  const cached = detectCache.get(cacheKey);
  if (cached) {
    return { manifest, installed: cached.installed, version: cached.version, settingsState, detectError: cached.error };
  }

  const detectCmd = manifest.detect ?? `command -v ${manifest.binary}`;
  try {
    const output = execFileSync('sh', ['-c', detectCmd], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    const version = output.toString().trim().split('\n')[0] || undefined;
    detectCache.set(cacheKey, { installed: true, version });
    return { manifest, installed: true, version, settingsState };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'detection failed';
    detectCache.set(cacheKey, { installed: false, error });
    return { manifest, installed: false, settingsState, detectError: error };
  }
}

/**
 * Clear the detection cache (for testing).
 */
export function clearDetectCache(): void {
  detectCache.clear();
}

// ============================================================================
// Adapter Registry (static imports -- no dynamic import())
// ============================================================================

import type { AdapterFactory } from './types.ts';

/**
 * Static registry mapping tool names to their adapter factory modules.
 * Uses lazy imports to avoid loading all adapter code upfront.
 */
export const ADAPTER_REGISTRY: Record<string, () => Promise<{ createAdapter: AdapterFactory }>> = {
  'fs-tasks': () => import('./tools/built-in/fs-tasks/adapter.ts'),
  'br': () => import('./tools/external/br/adapter.ts'),
  'bv': () => import('./tools/external/bv/adapter.ts'),
  'cass': () => import('./tools/external/cass/adapter.ts'),
  'agent-mail': () => import('./tools/external/agent-mail/adapter.ts'),
};

/**
 * Load an adapter factory by tool name.
 */
export async function loadAdapterFactory(toolName: string): Promise<AdapterFactory | null> {
  const loader = ADAPTER_REGISTRY[toolName];
  if (!loader) return null;
  const mod = await loader();
  return mod.createAdapter;
}
