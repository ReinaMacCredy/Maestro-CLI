import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdin, writeOutput, resolveProjectDir, logHookError } from './_helpers.ts';
import { initServices } from '../services.ts';
import { checkStatus } from '../usecases/check-status.ts';

const HOOK_NAME = 'precompact';

async function main(): Promise<void> {
  await readStdin();

  const projectDir = resolveProjectDir();
  if (!projectDir) {
    writeOutput({});
    return;
  }

  const services = initServices(projectDir);
  const activeFeature = services.featureAdapter.getActive();

  const sessionsDir = path.join(projectDir, '.maestro', 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const snapshotPath = path.join(sessionsDir, 'compact-snapshot.json');

  if (!activeFeature) {
    // Minimal snapshot when no feature is active
    const snapshot = {
      timestamp: new Date().toISOString(),
      feature: null,
      tasks: { total: 0, pending: 0, inProgress: 0, done: 0 },
      runnable: [],
      nextAction: 'No active feature. Create one with maestro feature-create.',
      recentEvents: [],
      contextFiles: [],
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    writeOutput({});
    return;
  }

  const featureName = activeFeature.name;
  const status = await checkStatus(services, featureName);

  // Read recent events (last 50 lines)
  const eventsPath = path.join(sessionsDir, 'events.jsonl');
  let recentEvents: unknown[] = [];
  if (fs.existsSync(eventsPath)) {
    // Read up to 64KB from the end to avoid unbounded memory on large files
    const stat = fs.statSync(eventsPath);
    const maxTailBytes = 65536;
    const buf = Buffer.alloc(Math.min(stat.size, maxTailBytes));
    const fd = fs.openSync(eventsPath, 'r');
    fs.readSync(fd, buf, 0, buf.length, Math.max(0, stat.size - maxTailBytes));
    fs.closeSync(fd);
    const lines = buf.toString('utf-8').split('\n').filter(Boolean);
    const lastLines = lines.slice(-50);
    recentEvents = lastLines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  }

  // Read context file names
  const contextEntries = services.contextAdapter.list(featureName);
  const contextFiles = contextEntries.map((entry) => entry.name);

  const snapshot = {
    timestamp: new Date().toISOString(),
    feature: {
      name: status.feature.name,
      status: status.feature.status,
    },
    tasks: {
      total: status.tasks.total,
      pending: status.tasks.pending,
      inProgress: status.tasks.inProgress,
      done: status.tasks.done,
    },
    runnable: status.runnable,
    nextAction: status.nextAction,
    recentEvents,
    contextFiles,
  };

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  writeOutput({});
}

try {
  await main();
} catch (error) {
  logHookError(resolveProjectDir(), HOOK_NAME, error);
  writeOutput({});
}
