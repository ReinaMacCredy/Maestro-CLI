import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

import { HttpTransport } from '../../toolbox/sdk/http-transport.ts';

// ============================================================================
// Mock fetch
// ============================================================================

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, opts?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = handler as typeof globalThis.fetch;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('HttpTransport', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('GET request parses JSON response', async () => {
    mockFetch(() => jsonResponse({ ok: true }));
    const transport = new HttpTransport({ baseUrl: 'http://test.local' });
    const result = await transport.get('/health');
    expect(result).toEqual({ ok: true });
  });

  it('POST request sends body', async () => {
    let capturedBody: string | undefined;
    mockFetch(async (_url, opts) => {
      capturedBody = await new Request('http://x', opts).text();
      return jsonResponse({ created: true }, 201);
    });

    const transport = new HttpTransport({ baseUrl: 'http://test.local' });
    // 201 is not >= 500 and response.ok is true (2xx)
    const result = await transport.post('/items', { name: 'test' });
    expect(result).toEqual({ created: true });
    expect(capturedBody).toBe('{"name":"test"}');
  });

  it('sends auth headers', async () => {
    let capturedHeaders: Record<string, string> = {};
    mockFetch((_url, opts) => {
      const h = opts?.headers as Record<string, string>;
      capturedHeaders = { ...h };
      return jsonResponse({ auth: true });
    });

    const transport = new HttpTransport({
      baseUrl: 'http://test.local',
      authHeaders: { Authorization: 'Bearer tok123' },
    });
    await transport.get('/secure');
    expect(capturedHeaders['Authorization']).toBe('Bearer tok123');
  });

  it('retries on 5xx', async () => {
    let attempts = 0;
    mockFetch(() => {
      attempts++;
      if (attempts < 3) return jsonResponse({ error: 'retry' }, 503);
      return jsonResponse({ ok: true });
    });

    const transport = new HttpTransport({
      baseUrl: 'http://test.local',
      retryDelays: [10, 10, 10],
    });
    const result = await transport.get('/flaky');
    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(3);
  });

  it('bestEffort returns null on error', async () => {
    mockFetch(() => jsonResponse({ error: 'fail' }, 500));
    const transport = new HttpTransport({
      baseUrl: 'http://test.local',
      bestEffort: true,
      retryDelays: [], // no retries
    });
    const result = await transport.get('/fail');
    expect(result).toBeNull();
  });

  it('throws on non-5xx error without bestEffort', async () => {
    mockFetch(() => new Response('Not Found', { status: 404, statusText: 'Not Found' }));
    const transport = new HttpTransport({
      baseUrl: 'http://test.local',
      retryDelays: [],
    });
    try {
      await transport.get('/missing');
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { message: string };
      expect(e.message).toContain('HTTP 404');
    }
  });

  it('rpc call returns tool result', async () => {
    mockFetch(() => jsonResponse({
      result: { content: [{ text: 'hello' }], isError: false },
    }));
    const transport = new HttpTransport({ baseUrl: 'http://test.local' });
    const result = await transport.rpc('test_tool', { arg: 1 });
    expect(result.isError).toBe(false);
    expect(result.text).toBe('hello');
  });
});
