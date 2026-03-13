/**
 * Filesystem-based ask adapter for maestroCLI.
 * Forked from hive-core/src/services/askService.ts -- direct copy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ensureDir, fileExists, readJson, writeJsonAtomic } from '../../utils/fs-io.ts';

export interface Ask {
  id: string;
  question: string;
  feature: string;
  timestamp: string;
  answered: boolean;
}

export interface AskAnswer {
  id: string;
  answer: string;
  timestamp: string;
}

export class FsAskAdapter {
  constructor(private projectRoot: string) {}

  private getAsksDir(feature: string): string {
    return path.join(this.projectRoot, '.maestro', 'features', feature, 'asks');
  }

  private ensureAsksDir(feature: string): void {
    ensureDir(this.getAsksDir(feature));
  }

  createAsk(feature: string, question: string): Ask {
    this.ensureAsksDir(feature);

    const id = `ask_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const ask: Ask = {
      id,
      question,
      feature,
      timestamp: new Date().toISOString(),
      answered: false,
    };

    const asksDir = this.getAsksDir(feature);
    const askPath = path.join(asksDir, `${id}.json`);
    const lockPath = path.join(asksDir, `${id}.lock`);

    writeJsonAtomic(askPath, ask);
    fs.writeFileSync(lockPath, '');

    return ask;
  }

  isLocked(feature: string, askId: string): boolean {
    const lockPath = path.join(this.getAsksDir(feature), `${askId}.lock`);
    return fileExists(lockPath);
  }

  getAnswer(feature: string, askId: string): AskAnswer | null {
    const answerPath = path.join(this.getAsksDir(feature), `${askId}-answer.json`);
    return readJson<AskAnswer>(answerPath);
  }

  submitAnswer(feature: string, askId: string, answer: string): void {
    const asksDir = this.getAsksDir(feature);
    const answerPath = path.join(asksDir, `${askId}-answer.json`);
    const lockPath = path.join(asksDir, `${askId}.lock`);

    const answerData: AskAnswer = {
      id: askId,
      answer,
      timestamp: new Date().toISOString(),
    };

    writeJsonAtomic(answerPath, answerData);

    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Lock already removed
    }
  }

  listPending(feature: string): Ask[] {
    const asksDir = this.getAsksDir(feature);
    let files: string[];
    try {
      files = fs.readdirSync(asksDir);
    } catch {
      return [];
    }

    const pending: Ask[] = [];

    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('-answer')) {
        const askId = file.replace('.json', '');
        const lockPath = path.join(asksDir, `${askId}.lock`);

        if (fileExists(lockPath)) {
          const ask = readJson<Ask>(path.join(asksDir, file));
          if (ask) pending.push(ask);
        }
      }
    }

    return pending.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  cleanup(feature: string, askId: string): void {
    const asksDir = this.getAsksDir(feature);
    for (const suffix of ['.json', '-answer.json', '.lock']) {
      try {
        fs.unlinkSync(path.join(asksDir, `${askId}${suffix}`));
      } catch {
        // File already removed
      }
    }
  }
}
