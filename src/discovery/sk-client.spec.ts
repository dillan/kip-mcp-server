import { SkClient } from './sk-client.js';

const captureHeaders = (seen: Array<Record<string, string>>): typeof fetch =>
  (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
    seen.push(init?.headers ?? {});
    return new Response(JSON.stringify({ server: { version: '2.0.0' } }), { status: 200 });
  }) as unknown as typeof fetch;

describe('SkClient auth', () => {
  it('sends the token from getToken as a JWT Authorization header', async () => {
    const seen: Array<Record<string, string>> = [];
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      getToken: async () => 'tok-1',
      fetchImpl: captureHeaders(seen),
    });
    await sk.getServerInfo();
    expect(seen[0]?.authorization).toBe('JWT tok-1');
  });

  it('omits the Authorization header when no token is available', async () => {
    const seen: Array<Record<string, string>> = [];
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      getToken: async () => undefined,
      fetchImpl: captureHeaders(seen),
    });
    await sk.getServerInfo();
    expect(seen[0]?.authorization).toBeUndefined();
  });

  it('still supports a static token', async () => {
    const seen: Array<Record<string, string>> = [];
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      token: 'static-tok',
      fetchImpl: captureHeaders(seen),
    });
    await sk.getServerInfo();
    expect(seen[0]?.authorization).toBe('JWT static-tok');
  });
});

describe('SkClient token renewal', () => {
  // A server that rejects any token except "JWT fresh".
  const renewingFetch = (counters: { attempts: number }): typeof fetch =>
    (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      counters.attempts += 1;
      if (init?.headers?.authorization === 'JWT fresh') {
        return new Response(JSON.stringify({ server: { version: '2.0.0' } }), { status: 200 });
      }
      return new Response('unauthorized', { status: 401 });
    }) as unknown as typeof fetch;

  it('refreshes the token and retries once after a 401', async () => {
    const counters = { attempts: 0 };
    let refreshed = false;
    const getToken = async (opts?: { forceRefresh?: boolean }) => {
      if (opts?.forceRefresh) refreshed = true;
      return refreshed ? 'fresh' : 'stale';
    };
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      getToken,
      fetchImpl: renewingFetch(counters),
    });
    const info = await sk.getServerInfo();
    expect(info.version).toBe('2.0.0');
    expect(counters.attempts).toBe(2); // initial 401 + one successful retry
  });

  it('does not retry when the refreshed token is unchanged', async () => {
    const counters = { attempts: 0 };
    const getToken = async () => 'static'; // forceRefresh yields the same token
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      getToken,
      fetchImpl: renewingFetch(counters),
    });
    await expect(sk.getServerInfo()).rejects.toThrow(/401/);
    expect(counters.attempts).toBe(1); // no pointless retry with an unchanged token
  });

  it('retries at most once, then surfaces the auth error', async () => {
    const counters = { attempts: 0 };
    let n = 0;
    const getToken = async () => `tok-${(n += 1)}`; // always a different token
    const alwaysUnauthorized = (async () => {
      counters.attempts += 1;
      return new Response('no', { status: 401 });
    }) as unknown as typeof fetch;
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      getToken,
      fetchImpl: alwaysUnauthorized,
    });
    await expect(sk.getServerInfo()).rejects.toThrow(/401|SIGNALK/);
    expect(counters.attempts).toBe(2); // initial + exactly one retry, never loops
  });

  it('does not retry when the refresh yields no token', async () => {
    const counters = { attempts: 0 };
    const getToken = async (opts?: { forceRefresh?: boolean }) =>
      opts?.forceRefresh ? undefined : 'stale'; // token lost on refresh (e.g. revoked)
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      getToken,
      fetchImpl: renewingFetch(counters),
    });
    await expect(sk.getServerInfo()).rejects.toThrow(/401/);
    expect(counters.attempts).toBe(1); // refresh returned undefined -> no retry
  });
});
