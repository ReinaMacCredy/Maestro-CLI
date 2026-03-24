/**
 * CLI subprocess transport.
 * Absorbs CliRunner patterns: retry, JSON parsing, ENOENT handling.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MaestroError } from '../../core/errors.ts';
import type { CliTransportConfig } from './types.ts';

const execFileAsync = promisify(execFile);

const DEFAULT_RETRY_DELAYS = [100, 300, 1000];
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

export class CliTransport {
  private config: CliTransportConfig;

  constructor(config: CliTransportConfig) {
    this.config = config;
  }

  /**
   * Execute a CLI command with JSON parsing and retry on transient errors.
   * Stdout is parsed as JSON when possible; returned as raw string otherwise.
   */
  async exec<T = unknown>(args: string[]): Promise<T> {
    const retryDelays = this.config.retryDelays ?? DEFAULT_RETRY_DELAYS;
    const retryExitCodes = new Set(this.config.retryExitCodes ?? []);
    const maxBuffer = this.config.maxBuffer ?? DEFAULT_MAX_BUFFER;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        const { stdout } = await execFileAsync(this.config.binary, args, {
          cwd: this.config.cwd,
          maxBuffer,
        });

        try {
          return JSON.parse(stdout) as T;
        } catch {
          return stdout as unknown as T;
        }
      } catch (err) {
        if (err instanceof MaestroError) throw err;

        const error = err as NodeJS.ErrnoException & {
          code?: string;
          exitCode?: number;
          status?: number;
          stdout?: string;
          stderr?: string;
        };

        if (error.code === 'ENOENT') {
          throw new MaestroError(
            `${this.config.toolName} not found`,
            this.config.installHint ? [this.config.installHint] : [],
          );
        }

        const exitCode = error.exitCode ?? error.status ?? 1;
        const stdout = error.stdout || '';
        const stderr = error.stderr || '';

        if (retryExitCodes.has(exitCode) && attempt < retryDelays.length) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          continue;
        }

        throw new MaestroError(
          `${this.config.toolName} command failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`,
          retryExitCodes.has(exitCode)
            ? [`${this.config.toolName} database locked. Retry or check for other processes.`]
            : [],
        );
      }
    }

    throw new MaestroError(`${this.config.toolName} command failed after retries`);
  }
}
