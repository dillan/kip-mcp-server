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
