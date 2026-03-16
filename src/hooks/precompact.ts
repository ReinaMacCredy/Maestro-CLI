import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdin, writeOutput, resolveProjectDir, logHookError, getSessionsDir, EVENTS_FILE } from './_helpers.ts';
import { writeJsonAtomic } from '../utils/fs-io.ts';
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

  const sessionsDir = getSessionsDir(projectDir);
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
      memoryFiles: [],
    };
    writeJsonAtomic(snapshotPath, snapshot);
    writeOutput({});
    return;
  }

  const featureName = activeFeature.name;
  const status = await checkStatus(services, featureName);

  // Read recent events (last 50 lines)
  const eventsPath = path.join(sessionsDir, EVENTS_FILE);
  let recentEvents: unknown[] = [];
  let fd: number | undefined;
  try {
    // Open directly -- no existence check needed (ENOENT caught below)
    fd = fs.openSync(eventsPath, 'r');
    const stat = fs.fstatSync(fd);
    const maxTailBytes = 65536;
    const buf = Buffer.allocUnsafe(Math.min(stat.size, maxTailBytes));
    fs.readSync(fd, buf, 0, buf.length, Math.max(0, stat.size - maxTailBytes));
    const lines = buf.toString('utf-8').split('\n').filter(Boolean);
    const lastLines = lines.slice(-50);
    recentEvents = lastLines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }

  // Read memory file names
  const memoryEntries = services.memoryAdapter.list(featureName);
  const memoryFiles = memoryEntries.map((entry) => entry.name);

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
    memoryFiles,
  };

  writeJsonAtomic(snapshotPath, snapshot);
  writeOutput({});
}

try {
  await main();
} catch (error) {
  logHookError(resolveProjectDir(), HOOK_NAME, error);
  writeOutput({});
}
