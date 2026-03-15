import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanRepo } from '../../symphony/scanner.ts';
import { renderAgentsMd } from '../../symphony/renderers/agents.ts';
import { renderAllContext } from '../../symphony/renderers/context.ts';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-test-'));
  // Minimal git dir so it looks like a repo
  fs.mkdirSync(path.join(tmpDir, '.git'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scanRepo', () => {
  test('empty repo returns unknown project type', () => {
    const scan = scanRepo(tmpDir);
    expect(scan.projectType).toBe('unknown');
    expect(scan.languages).toEqual([]);
    expect(scan.frameworks).toEqual([]);
    expect(scan.tools).toEqual([]);
    expect(scan.isMonorepo).toBe(false);
    expect(scan.packageManager).toBeUndefined();
  });

  test('TS/Bun project detected correctly', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'my-app',
      scripts: { build: 'bun run build', test: 'bun test', dev: 'bun run dev' },
      devDependencies: { typescript: '^5.0.0' },
    }));
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
    fs.mkdirSync(path.join(tmpDir, 'src'));

    const scan = scanRepo(tmpDir);
    expect(scan.projectType).toBe('node');
    expect(scan.languages).toContain('typescript');
    expect(scan.packageManager).toBe('bun');
    expect(scan.buildCommand).toBe('bun run build');
    expect(scan.testCommand).toBe('bun test');
    expect(scan.sourceRoots).toContain('src');
  });

  test('Python project detected correctly', () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[project]\nname = "mylib"');

    const scan = scanRepo(tmpDir);
    expect(scan.projectType).toBe('python');
    expect(scan.languages).toContain('python');
  });

  test('polyglot repo lists both languages', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'fullstack',
      devDependencies: { typescript: '^5' },
    }));
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[project]\nname = "api"');

    const scan = scanRepo(tmpDir);
    expect(scan.projectType).toBe('node'); // first match wins
    expect(scan.languages).toContain('typescript');
    expect(scan.languages).toContain('python');
  });

  test('monorepo with workspaces detected', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'mono',
      workspaces: ['packages/*'],
    }));

    const scan = scanRepo(tmpDir);
    expect(scan.isMonorepo).toBe(true);
    expect(scan.monorepoPackages).toEqual(['packages/*']);
  });

  test('detects tools from config files', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'app',
      devDependencies: { eslint: '^8', prettier: '^3', vitest: '^1' },
    }));

    const scan = scanRepo(tmpDir);
    expect(scan.tools).toContain('eslint');
    expect(scan.tools).toContain('prettier');
    expect(scan.tools).toContain('vitest');
  });

  test('detects frameworks from dependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'web',
      dependencies: { react: '^18', next: '^14' },
    }));

    const scan = scanRepo(tmpDir);
    expect(scan.frameworks).toContain('React');
    expect(scan.frameworks).toContain('Next.js');
  });

  test('extracts README description', () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# My Project\n\nA really cool project that does amazing things.\n');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'my-project' }));

    const scan = scanRepo(tmpDir);
    expect(scan.audience).toBe('A really cool project that does amazing things.');
  });

  test('package manager detection: uv', () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[project]\nname = "api"');
    fs.writeFileSync(path.join(tmpDir, 'uv.lock'), '');

    const scan = scanRepo(tmpDir);
    expect(scan.packageManager).toBe('uv');
  });
});

describe('renderAgentsMd', () => {
  test('emits concrete commands from scan', () => {
    // Set up a TS project
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-app',
      scripts: { build: 'tsc', test: 'vitest' },
      devDependencies: { typescript: '^5', eslint: '^8' },
    }));
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
    fs.mkdirSync(path.join(tmpDir, 'src'));

    const result = scanRepo(tmpDir);
    const md = renderAgentsMd(result, 'test-app');

    expect(md).toContain('# test-app');
    expect(md).toContain('`bun run build`');
    expect(md).toContain('`bun test`');
    expect(md).toContain('Source roots: `src/`');
    expect(md).toContain('ESLint');
    expect(md).not.toContain('TypeScript is a typed superset'); // no filler
  });

  test('omits sections when commands are missing', () => {
    const md = renderAgentsMd(scanRepo(tmpDir), 'empty');
    expect(md).toContain('# empty');
    expect(md).not.toContain('## Commands');
  });
});

describe('renderAllContext', () => {
  test('generates expected file set without product guidelines', () => {
    const scan = scanRepo(tmpDir);
    scan.languages = ['typescript'];
    scan.packageManager = 'bun';

    const files = renderAllContext(scan, 'test-proj');
    const paths = files.map(f => f.path);

    expect(paths).toContain('.maestro/context/product.md');
    expect(paths).toContain('.maestro/context/tech-stack.md');
    expect(paths).toContain('.maestro/context/guidelines.md');
    expect(paths).toContain('.maestro/context/workflow.md');
    expect(paths).toContain('.maestro/context/index.md');
    expect(paths).toContain('.maestro/tracks.md');
    expect(paths).not.toContain('.maestro/context/product-guidelines.md');
  });

  test('includes product-guidelines when flag is set', () => {
    const scan = scanRepo(tmpDir);
    scan.hasProductGuidelines = true;

    const files = renderAllContext(scan, 'test-proj');
    const paths = files.map(f => f.path);
    expect(paths).toContain('.maestro/context/product-guidelines.md');
  });

  test('product.md contains project name', () => {
    const scan = scanRepo(tmpDir);
    const files = renderAllContext(scan, 'my-project');
    const product = files.find(f => f.path.endsWith('product.md'))!;
    expect(product.content).toContain('my-project');
  });

  test('index.md references other context files', () => {
    const scan = scanRepo(tmpDir);
    const files = renderAllContext(scan, 'proj');
    const index = files.find(f => f.path.endsWith('index.md'))!;
    expect(index.content).toContain('product.md');
    expect(index.content).toContain('tech-stack.md');
  });
});
