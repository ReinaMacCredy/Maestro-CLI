/**
 * CliRunner -- shared CLI exec+retry utility for external tool adapters.
 *
 * Used by BrTaskAdapter, BvGraphAdapter, CassSearchAdapter to call
 * external CLIs with JSON parsing and transient-error retry.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MaestroError } from './errors.ts';

const execFileAsync = promisify(execFile);

export interface CliRunnerOpts {
  /** Working directory for all commands. */
  cwd: string;
  /** Exit codes that trigger automatic retry (e.g. SQLite lock = 5). */
  retryExitCodes?: number[];
  /** Delay (ms) between retries. Length determines max retry count. */
  retryDelays?: number[];
  /** Max stdout buffer in bytes. Default: 10 MiB. */
  maxBuffer?: number;
  /** Human-readable tool name for error messages (e.g. "br", "bv"). */
  toolName: string;
  /** Install hint shown when binary is not found. */
  installHint?: string;
}

const DEFAULT_RETRY_DELAYS = [100, 300, 1000];
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

export class CliRunner {
  private binary: string;
  private opts: CliRunnerOpts;

  constructor(binary: string, opts: CliRunnerOpts) {
    this.binary = binary;
    this.opts = opts;
  }

  /**
   * Execute a CLI command with JSON parsing and retry on transient errors.
   * Stdout is parsed as JSON when possible; returned as raw string otherwise.
   */
  async exec<T = unknown>(args: string[]): Promise<T> {
    const retryDelays = this.opts.retryDelays ?? DEFAULT_RETRY_DELAYS;
    const retryExitCodes = new Set(this.opts.retryExitCodes ?? []);
    const maxBuffer = this.opts.maxBuffer ?? DEFAULT_MAX_BUFFER;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        const { stdout } = await execFileAsync(this.binary, args, {
          cwd: this.opts.cwd,
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
            `${this.opts.toolName} not found`,
            this.opts.installHint ? [this.opts.installHint] : [],
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
          `${this.opts.toolName} command failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`,
          retryExitCodes.has(exitCode)
            ? [`${this.opts.toolName} database locked. Retry or check for other processes.`]
            : [],
        );
      }
    }

    throw new MaestroError(`${this.opts.toolName} command failed after retries`);
  }
}
