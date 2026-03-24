/**
 * HTTP fetch transport with retry, timeout, auth, and best-effort mode.
 */

import { MaestroError } from '../../core/errors.ts';
import type { HttpTransportConfig } from './types.ts';

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRY_DELAYS = [200, 500, 1000];

export class HttpTransport {
  private config: HttpTransportConfig;

  constructor(config: HttpTransportConfig) {
    this.config = config;
  }

  async get<T = unknown>(path: string): Promise<T | null> {
    return this.request<T>('GET', path);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T | null> {
    return this.request<T>('POST', path, body);
  }

  /**
   * JSON-RPC style call (matches Agent Mail MCP protocol).
   */
  async rpc(tool: string, args: Record<string, unknown>): Promise<{ isError: boolean; text?: string }> {
    const result = await this.request<{
      result?: { content?: Array<{ text?: string }>; isError?: boolean };
      error?: { message?: string };
    }>('POST', '/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: tool, arguments: args },
    });

    if (!result) return { isError: true, text: 'No response' };
    if (result.error) return { isError: true, text: result.error.message };
    const content = result.result?.content?.[0];
    return { isError: !!result.result?.isError, text: content?.text };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const url = `${this.config.baseUrl}${path}`;
    const timeout = this.config.timeout ?? DEFAULT_TIMEOUT;
    const retryDelays = this.config.retryDelays ?? DEFAULT_RETRY_DELAYS;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.authHeaders,
    };

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeout),
        });

        if (response.status >= 500 && attempt < retryDelays.length) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          continue;
        }

        if (!response.ok) {
          if (this.config.bestEffort) return null;
          throw new MaestroError(`HTTP ${response.status}: ${response.statusText} (${url})`);
        }

        const text = await response.text();
        try {
          return JSON.parse(text) as T;
        } catch {
          return text as unknown as T;
        }
      } catch (err) {
        if (err instanceof MaestroError) throw err;

        if (attempt < retryDelays.length) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          continue;
        }

        if (this.config.bestEffort) return null;

        const message = err instanceof Error ? err.message : String(err);
        throw new MaestroError(`HTTP request failed: ${message} (${url})`);
      }
    }

    if (this.config.bestEffort) return null;
    throw new MaestroError(`HTTP request failed after retries (${url})`);
  }
}
