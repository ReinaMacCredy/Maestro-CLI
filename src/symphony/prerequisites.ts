/**
 * Prerequisite validation for Symphony install.
 */

import { execFileSync } from 'node:child_process';

interface PrereqResult {
  ok: boolean;
  tool: string;
  message?: string;
}

function checkTool(name: string, hint?: string): PrereqResult {
  try {
    execFileSync('which', [name], { stdio: 'pipe' });
    return { ok: true, tool: name };
  } catch {
    return { ok: false, tool: name, message: hint || `${name} not found in PATH` };
  }
}

function checkEnvVar(name: string, hint?: string): PrereqResult {
  if (process.env[name]) {
    return { ok: true, tool: name };
  }
  return { ok: false, tool: name, message: hint || `${name} not set` };
}

export interface PrereqCheckResult {
  passed: boolean;
  results: PrereqResult[];
}

export function checkPrerequisites(opts: { linearProject?: string }): PrereqCheckResult {
  const results: PrereqResult[] = [
    checkTool('git', 'git is required for repo operations'),
    checkTool('codex', 'codex CLI is required for Symphony workflow'),
    checkTool('python3', 'python3 is required by Codex runtime for skill execution'),
    checkTool('gh', 'GitHub CLI (gh) is required for PR operations'),
    checkEnvVar('OPENAI_API_KEY', 'OPENAI_API_KEY is required for Codex'),
  ];

  if (opts.linearProject) {
    results.push(checkEnvVar('LINEAR_API_KEY', 'LINEAR_API_KEY is required when --linear-project is used'));
  }

  return {
    passed: results.every(r => r.ok),
    results,
  };
}
