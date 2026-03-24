/**
 * Agent tool manifest loader and detection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'node:child_process';
import type { AgentToolManifest, AgentToolStatus } from './types.ts';

/**
 * Scan for agent tool manifests in the built-in directory.
 */
export function scanAgentTools(): AgentToolManifest[] {
  const manifests: AgentToolManifest[] = [];
  const builtInDir = path.join(import.meta.dir, 'built-in');

  if (!fs.existsSync(builtInDir)) return manifests;

  const entries = fs.readdirSync(builtInDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(builtInDir, entry.name, 'manifest.json');
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.name && parsed.binary && parsed.detect) {
        manifests.push(parsed as AgentToolManifest);
      }
    } catch {
      // Skip malformed manifests
    }
  }

  return manifests;
}

const detectCache = new Map<string, { installed: boolean; version?: string; error?: string }>();

/**
 * Detect whether an agent tool is installed.
 */
export function detectAgentTool(manifest: AgentToolManifest): AgentToolStatus {
  const cached = detectCache.get(manifest.name);
  if (cached) {
    return { manifest, installed: cached.installed, version: cached.version, detectError: cached.error };
  }

  try {
    const output = execFileSync('sh', ['-c', manifest.detect], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    const version = output.toString().trim().split('\n')[0] || undefined;
    detectCache.set(manifest.name, { installed: true, version });
    return { manifest, installed: true, version };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'detection failed';
    detectCache.set(manifest.name, { installed: false, error });
    return { manifest, installed: false, detectError: error };
  }
}

export function clearAgentToolCache(): void {
  detectCache.clear();
}
