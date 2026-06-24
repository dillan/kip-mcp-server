import { SkAppDataClient } from './appdata-client.js';

describe('SkAppDataClient token renewal', () => {
  it('refreshes the token and retries a read once after a 401', async () => {
    let attempts = 0;
    let refreshed = false;
    const fetchImpl = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      attempts += 1;
      if (init?.headers?.authorization === 'JWT fresh') {
        return new Response(JSON.stringify({ name: 'default', dashboards: [] }), { status: 200 });
      }
      return new Response('no', { status: 401 });
    }) as unknown as typeof fetch;
    const getToken = async (opts?: { forceRefresh?: boolean }) => {
      if (opts?.forceRefresh) refreshed = true;
      return refreshed ? 'fresh' : 'stale';
    };
    const client = new SkAppDataClient({ baseUrl: 'http://boat:3000', getToken, fetchImpl });
    const cfg = await client.getConfig('global', 'default', 1);
    expect(cfg).not.toBeNull();
    expect(attempts).toBe(2); // initial 401 + one successful retry
  });

  it('retries a write at most once, then surfaces the auth error', async () => {
    let attempts = 0;
    let n = 0;
    const fetchImpl = (async () => {
      attempts += 1;
      return new Response('no', { status: 403 });
    }) as unknown as typeof fetch;
    const getToken = async () => `tok-${(n += 1)}`; // always a different token
    const client = new SkAppDataClient({ baseUrl: 'http://boat:3000', getToken, fetchImpl });
    await expect(client.postFull('global', 'default', 1, { dashboards: [] })).rejects.toThrow(
      /403|applicationData/,
    );
    expect(attempts).toBe(2); // initial + exactly one retry, never loops
  });

  it('retries a write with the fresh token, preserving method and body', async () => {
    const calls: Array<{ method?: string; body?: unknown; auth?: string }> = [];
    let refreshed = false;
    const fetchImpl = (async (
      _url: unknown,
      init?: { method?: string; body?: unknown; headers?: Record<string, string> },
    ) => {
      const auth = init?.headers?.authorization;
      calls.push({ method: init?.method, body: init?.body, auth });
      if (auth === 'JWT fresh') return new Response('', { status: 200 });
      return new Response('no', { status: 401 });
    }) as unknown as typeof fetch;
    const getToken = async (opts?: { forceRefresh?: boolean }) => {
      if (opts?.forceRefresh) refreshed = true;
      return refreshed ? 'fresh' : 'stale';
    };
    const client = new SkAppDataClient({ baseUrl: 'http://boat:3000', getToken, fetchImpl });
    await client.postFull('global', 'default', 1, { dashboards: [] });
    expect(calls).toHaveLength(2); // initial 401 + retry
    expect(calls[1]?.method).toBe('POST'); // method survives the retry
    expect(calls[1]?.body).toBe(JSON.stringify({ dashboards: [] })); // body survives the retry
    expect(calls[1]?.auth).toBe('JWT fresh'); // retry carries the refreshed token
  });

  it('does not retry when the refresh yields no token', async () => {
    let attempts = 0;
    const fetchImpl = (async () => {
      attempts += 1;
      return new Response('no', { status: 401 });
    }) as unknown as typeof fetch;
    const getToken = async (opts?: { forceRefresh?: boolean }) =>
      opts?.forceRefresh ? undefined : 'stale';
    const client = new SkAppDataClient({ baseUrl: 'http://boat:3000', getToken, fetchImpl });
    await expect(client.getConfig('global', 'default', 1)).rejects.toThrow(/401|applicationData/);
    expect(attempts).toBe(1); // refresh returned undefined -> no retry
  });
});
