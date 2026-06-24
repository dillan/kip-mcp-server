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
});
