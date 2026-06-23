import { signalkLogin, TokenProvider } from './auth.js';

const captureFetch = (
  token: string,
  capture: { url?: string; init?: RequestInit },
): typeof fetch =>
  (async (url: unknown, init?: RequestInit) => {
    capture.url = String(url);
    capture.init = init;
    return new Response(JSON.stringify({ token }), { status: 200 });
  }) as unknown as typeof fetch;

const statusFetch = (status: number): typeof fetch =>
  (async () => new Response('no', { status })) as unknown as typeof fetch;

describe('signalkLogin', () => {
  it('posts the credentials to the auth/login endpoint and returns the token', async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    const token = await signalkLogin(
      'http://boat:3000',
      { username: 'u', password: 'p' },
      captureFetch('jwt-1', capture),
    );
    expect(token).toBe('jwt-1');
    expect(capture.url).toBe('http://boat:3000/signalk/v1/auth/login');
    expect(capture.init?.method).toBe('POST');
    expect(JSON.parse(String(capture.init?.body))).toEqual({ username: 'u', password: 'p' });
  });

  it('throws a clear error on a rejected login (401)', async () => {
    await expect(
      signalkLogin('http://boat:3000', { username: 'u', password: 'bad' }, statusFetch(401)),
    ).rejects.toThrow(/401|password|SIGNALK_USER/i);
  });
});

describe('TokenProvider', () => {
  it('returns a static token without logging in', async () => {
    const provider = new TokenProvider({ baseUrl: 'http://boat:3000', token: 'static-1' });
    expect(await provider.get()).toBe('static-1');
  });

  it('returns undefined when no token or credentials are configured', async () => {
    const provider = new TokenProvider({ baseUrl: 'http://boat:3000' });
    expect(await provider.get()).toBeUndefined();
  });

  it('logs in once with credentials and reuses the token', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ token: 'jwt-2' }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new TokenProvider({
      baseUrl: 'http://boat:3000',
      credentials: { username: 'u', password: 'p' },
      fetchImpl,
    });
    expect(await provider.get()).toBe('jwt-2');
    expect(await provider.get()).toBe('jwt-2');
    expect(calls).toBe(1);
  });
});
