import { describe, test, expect } from 'bun:test';
import { executionInsights } from '../../usecases/execution-insights.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { buildExecutionMemory } from '../../memory/execution/writer.ts';

const FEATURE = 'test-feature';

function makeMemoryAdapter(memories: Array<{ name: string; content: string }> = []) {
  return {
    written: [] as Array<{ feature: string; name: string; content: string }>,
    write(feature: string, name: string, content: string) {
      this.written.push({ feature, name, content });
      return name;
    },
    read() { return null; },
    list() { return memories.map(m => ({ name: m.name, content: m.content, updatedAt: new Date().toISOString(), sizeBytes: Buffer.byteLength(m.content) })); },
    listWithMeta() {
      return memories.map(m => ({
        name: m.name,
        content: m.content,
        updatedAt: new Date().toISOString(),
        sizeBytes: Buffer.byteLength(m.content),
        metadata: { tags: ['execution'], priority: 1, category: 'execution' as const },
        bodyContent: m.content,
      }));
    },
    delete() { return false; },
    compile() { return ''; },
    archive() { return { archived: [], archivePath: '' }; },
    stats() { return { count: 0, totalBytes: 0 }; },
    writeGlobal() { return ''; },
    readGlobal() { return null; },
    listGlobal() { return []; },
    deleteGlobal() { return false; },
  };
}

describe('executionInsights', () => {
  test('returns empty insights for feature with no execution memories', async () => {
    const taskPort = new InMemoryTaskPort();
    taskPort.seed(FEATURE, '01-setup', { status: 'done' });
    const mem = makeMemoryAdapter([]);

    const result = await executionInsights(FEATURE, taskPort, mem);

    expect(result.feature).toBe(FEATURE);
    expect(result.insights).toHaveLength(0);
    expect(result.coverage.totalTasks).toBe(1);
    expect(result.coverage.withExecMemory).toBe(0);
    expect(result.coverage.percent).toBe(0);
    expect(result.knowledgeFlow).toHaveLength(0);
  });

  test('correctly identifies task with execution memory', async () => {
    const taskPort = new InMemoryTaskPort();
    taskPort.seed(FEATURE, '01-setup', { status: 'done' });
    taskPort.seed(FEATURE, '02-build', { status: 'claimed', dependsOn: ['01-setup'] });

    const execMem = buildExecutionMemory({
      taskFolder: '01-setup',
      taskName: 'Setup',
      summary: 'Set up the project',
      verificationReport: { passed: true, score: 1, criteria: [], suggestions: [], timestamp: '' },
      changedFiles: ['src/index.ts', 'src/config.ts'],
    });

    const mem = makeMemoryAdapter([{ name: execMem.fileName, content: execMem.content }]);

    const result = await executionInsights(FEATURE, taskPort, mem);

    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].sourceTask).toBe('01-setup');
    expect(result.insights[0].summary).toBe('Set up the project');
    expect(result.insights[0].filesChanged).toBe(2);
    expect(result.insights[0].verificationPassed).toBe(true);
  });

  test('coverage calculation is accurate', async () => {
    const taskPort = new InMemoryTaskPort();
    taskPort.seed(FEATURE, '01-setup', { status: 'done' });
    taskPort.seed(FEATURE, '02-build', { status: 'done', dependsOn: ['01-setup'] });
    taskPort.seed(FEATURE, '03-test', { status: 'pending', dependsOn: ['02-build'] });

    const exec1 = buildExecutionMemory({
      taskFolder: '01-setup', taskName: 'Setup', summary: 'Done',
      verificationReport: null,
    });
    const exec2 = buildExecutionMemory({
      taskFolder: '02-build', taskName: 'Build', summary: 'Done',
      verificationReport: null,
    });

    const mem = makeMemoryAdapter([
      { name: exec1.fileName, content: exec1.content },
      { name: exec2.fileName, content: exec2.content },
    ]);

    const result = await executionInsights(FEATURE, taskPort, mem);

    expect(result.coverage.totalTasks).toBe(3);
    expect(result.coverage.withExecMemory).toBe(2);
    expect(result.coverage.percent).toBe(67); // 2/3 rounded
  });

  test('knowledge flow edges match dependency graph', async () => {
    const taskPort = new InMemoryTaskPort();
    taskPort.seed(FEATURE, '01-setup', { status: 'done', dependsOn: [] });
    taskPort.seed(FEATURE, '02-build', { status: 'done', dependsOn: ['01-setup'] });
    taskPort.seed(FEATURE, '03-test', { status: 'pending', dependsOn: ['02-build'] });

    const exec1 = buildExecutionMemory({
      taskFolder: '01-setup', taskName: 'Setup', summary: 'Done',
      verificationReport: null,
    });

    const mem = makeMemoryAdapter([{ name: exec1.fileName, content: exec1.content }]);

    const result = await executionInsights(FEATURE, taskPort, mem);

    // 01-setup -> 02-build (1 hop, 0.35)
    // 01-setup -> 03-test (2 hops, 0.15)
    expect(result.knowledgeFlow).toHaveLength(2);
    const flow1 = result.knowledgeFlow.find(f => f.to === '02-build');
    const flow2 = result.knowledgeFlow.find(f => f.to === '03-test');
    expect(flow1).toBeDefined();
    expect(flow1!.proximity).toBe(0.35);
    expect(flow2).toBeDefined();
    expect(flow2!.proximity).toBe(0.15);
  });

  test('handles features with no tasks gracefully', async () => {
    const taskPort = new InMemoryTaskPort();
    const mem = makeMemoryAdapter([]);

    const result = await executionInsights(FEATURE, taskPort, mem);

    expect(result.insights).toHaveLength(0);
    expect(result.coverage.totalTasks).toBe(0);
    expect(result.coverage.percent).toBe(0);
  });

  test('ignores exec memories for non-existent tasks', async () => {
    const taskPort = new InMemoryTaskPort();
    taskPort.seed(FEATURE, '01-setup', { status: 'done' });

    // Memory for a task that doesn't exist
    const mem = makeMemoryAdapter([{
      name: 'exec-99-nonexistent',
      content: '---\ntags: [execution]\ncategory: execution\n---\nTask **99-nonexistent** completed.\n\n**Summary**: ghost',
    }]);

    const result = await executionInsights(FEATURE, taskPort, mem);

    expect(result.insights).toHaveLength(0);
    expect(result.coverage.withExecMemory).toBe(0);
  });
});
