/**
 * Deterministic repo scanner for Symphony onboarding.
 * Reads repo files to produce a SymphonyScanSummary.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SymphonyScanSummary } from './types.ts';

interface PackageJson {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

// -- helpers --

function tryReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function tryParseJson<T>(filePath: string): T | null {
  const raw = tryReadFile(filePath);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function listDir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

// -- detection logic --

function detectProjectType(root: string): string {
  if (fileExists(path.join(root, 'package.json'))) return 'node';
  if (fileExists(path.join(root, 'pyproject.toml')) || fileExists(path.join(root, 'setup.py'))) return 'python';
  if (fileExists(path.join(root, 'go.mod'))) return 'go';
  if (fileExists(path.join(root, 'Cargo.toml'))) return 'rust';
  if (fileExists(path.join(root, 'build.gradle')) || fileExists(path.join(root, 'pom.xml'))) return 'jvm';
  return 'unknown';
}

function detectPackageManager(root: string): string | undefined {
  if (fileExists(path.join(root, 'bun.lockb')) || fileExists(path.join(root, 'bun.lock'))) return 'bun';
  if (fileExists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fileExists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fileExists(path.join(root, 'package-lock.json'))) return 'npm';
  if (fileExists(path.join(root, 'uv.lock'))) return 'uv';
  if (fileExists(path.join(root, 'poetry.lock'))) return 'poetry';
  return undefined;
}

function detectLanguages(root: string, projectType: string, pkg: PackageJson | null): string[] {
  const langs: string[] = [];

  if (projectType === 'node' || fileExists(path.join(root, 'package.json'))) {
    if (fileExists(path.join(root, 'tsconfig.json')) || pkg?.devDependencies?.['typescript']) {
      langs.push('typescript');
    } else {
      langs.push('javascript');
    }
  }
  if (projectType === 'python' || fileExists(path.join(root, 'pyproject.toml'))) {
    if (!langs.includes('python')) langs.push('python');
  }
  if (projectType === 'go') langs.push('go');
  if (projectType === 'rust') langs.push('rust');
  if (projectType === 'jvm') {
    if (fileExists(path.join(root, 'build.gradle.kts'))) langs.push('kotlin');
    else langs.push('java');
  }

  return langs;
}

function detectFrameworks(pkg: PackageJson | null): string[] {
  if (!pkg) return [];
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const frameworks: string[] = [];

  const frameworkMap: Record<string, string> = {
    react: 'React', next: 'Next.js', vue: 'Vue', nuxt: 'Nuxt',
    svelte: 'Svelte', angular: '@angular/core', express: 'Express',
    fastify: 'Fastify', hono: 'Hono', elysia: 'Elysia',
  };

  for (const [dep, name] of Object.entries(frameworkMap)) {
    if (allDeps[dep]) frameworks.push(name);
  }

  return frameworks;
}

function detectTools(root: string, pkg: PackageJson | null): string[] {
  const tools: string[] = [];
  const allDeps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};

  if (fileExists(path.join(root, '.eslintrc.js')) || fileExists(path.join(root, '.eslintrc.json')) ||
      fileExists(path.join(root, '.eslintrc.cjs')) || fileExists(path.join(root, 'eslint.config.js')) ||
      fileExists(path.join(root, 'eslint.config.mjs')) || allDeps['eslint']) {
    tools.push('eslint');
  }
  if (fileExists(path.join(root, '.prettierrc')) || fileExists(path.join(root, '.prettierrc.json')) ||
      fileExists(path.join(root, 'prettier.config.js')) || allDeps['prettier']) {
    tools.push('prettier');
  }
  if (fileExists(path.join(root, 'biome.json')) || fileExists(path.join(root, 'biome.jsonc')) || allDeps['@biomejs/biome']) {
    tools.push('biome');
  }
  if (fileExists(path.join(root, 'ruff.toml')) || fileExists(path.join(root, '.ruff.toml'))) {
    tools.push('ruff');
  }
  if (fileExists(path.join(root, 'Dockerfile')) || fileExists(path.join(root, 'docker-compose.yml')) ||
      fileExists(path.join(root, 'docker-compose.yaml'))) {
    tools.push('docker');
  }
  if (allDeps['vitest']) tools.push('vitest');
  if (allDeps['jest']) tools.push('jest');

  return tools;
}

function detectCommands(pkg: PackageJson | null): { build?: string; test?: string; dev?: string; lint?: string } {
  if (!pkg?.scripts) return {};
  const s = pkg.scripts;
  return {
    build: s.build ? `${detectPackageManagerForScripts()} run build` : undefined,
    test: s.test ? `${detectPackageManagerForScripts()} test` : undefined,
    dev: s.dev ? `${detectPackageManagerForScripts()} run dev` : undefined,
    lint: (s.lint ? `${detectPackageManagerForScripts()} run lint` : undefined),
  };
}

function detectPackageManagerForScripts(): string {
  // Simple default -- caller should use the actual detected package manager
  return 'bun';
}

function detectMonorepo(root: string, pkg: PackageJson | null): { isMonorepo: boolean; packages?: string[] } {
  if (pkg?.workspaces) {
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages;
    return { isMonorepo: true, packages: ws };
  }
  if (fileExists(path.join(root, 'pnpm-workspace.yaml'))) return { isMonorepo: true };
  if (fileExists(path.join(root, 'lerna.json'))) return { isMonorepo: true };

  // Check for multiple package.json at depth 1
  const entries = listDir(root);
  const subPackages = entries.filter(e => {
    const sub = path.join(root, e, 'package.json');
    return fileExists(sub);
  });
  if (subPackages.length >= 2) return { isMonorepo: true, packages: subPackages };

  return { isMonorepo: false };
}

function detectSourceRoots(root: string): string[] {
  const candidates = ['src', 'lib', 'app', 'packages', 'apps', 'modules'];
  return candidates.filter(c => {
    const p = path.join(root, c);
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
}

function extractReadmeDescription(root: string): string | undefined {
  const readme = tryReadFile(path.join(root, 'README.md')) || tryReadFile(path.join(root, 'README'));
  if (!readme) return undefined;

  // Extract first non-heading, non-empty paragraph
  const lines = readme.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('[')) continue;
    if (trimmed.length > 20) return trimmed;
  }
  return undefined;
}

// -- main scanner --

export function scanRepo(projectRoot: string): SymphonyScanSummary {
  const pkg = tryParseJson<PackageJson>(path.join(projectRoot, 'package.json'));
  const projectType = detectProjectType(projectRoot);
  const packageManager = detectPackageManager(projectRoot);
  const languages = detectLanguages(projectRoot, projectType, pkg);
  const frameworks = detectFrameworks(pkg);
  const tools = detectTools(projectRoot, pkg);
  const mono = detectMonorepo(projectRoot, pkg);
  const sourceRoots = detectSourceRoots(projectRoot);
  const commands = detectCommands(pkg);

  // Override command prefix with actual package manager
  const cmdPrefix = packageManager || 'npm';
  const fixCmd = (cmd: string | undefined): string | undefined => {
    if (!cmd) return undefined;
    return cmd.replace(/^bun/, cmdPrefix);
  };

  return {
    projectType,
    audience: extractReadmeDescription(projectRoot),
    languages,
    frameworks,
    tools,
    packageManager,
    buildCommand: fixCmd(commands.build),
    testCommand: fixCmd(commands.test),
    devCommand: fixCmd(commands.dev),
    lintCommand: fixCmd(commands.lint),
    isMonorepo: mono.isMonorepo,
    monorepoPackages: mono.packages,
    sourceRoots,
    hasProductGuidelines: false, // conservative default
  };
}
