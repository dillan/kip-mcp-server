import { readFileSync } from 'node:fs';
import { callDiscoveryTool } from '../discovery-tools.js';
import { discoverInventory } from './discover.js';
import { SkClient } from './sk-client.js';

const self = JSON.parse(
  readFileSync(new URL('./fixtures/sailboat-self.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

function fakeFetch(routes: Record<string, { status?: number; body: unknown }>): typeof fetch {
  return (async (url: unknown) => {
    const u = String(url);
    for (const [path, route] of Object.entries(routes)) {
      if (u.endsWith(path))
        return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
}

const fetchImpl = fakeFetch({
  '/signalk': { body: { server: { id: 'signalk-server-node', version: '2.13.0' } } },
  '/signalk/v1/api/vessels/self': { body: self },
  '/skServer/plugins': {
    body: [
      { id: 'anchoralarm', enabled: true },
      { id: 'freeboard-sk', enabled: false },
    ],
  },
});
const sk = new SkClient({ baseUrl: 'http://boat.local:3000', fetchImpl });

describe('SkClient', () => {
  it('reads server info', async () => {
    expect(await sk.getServerInfo()).toEqual({
      version: '2.13.0',
      serverId: 'signalk-server-node',
    });
  });

  it('sends a JWT auth header when a token is set', async () => {
    const seen: Array<Record<string, string> | undefined> = [];
    const capturing = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      seen.push(init?.headers);
      return new Response(JSON.stringify({ version: '2.0.0' }), { status: 200 });
    }) as unknown as typeof fetch;
    const authed = new SkClient({ baseUrl: 'http://x', token: 'abc', fetchImpl: capturing });
    await authed.getServerInfo();
    expect(seen[0]?.authorization).toBe('JWT abc');
  });

  it('returns [] plugins when the endpoint is unavailable', async () => {
    const sk2 = new SkClient({
      baseUrl: 'http://x',
      fetchImpl: fakeFetch({ '/signalk/v1/api/vessels/self': { body: self } }),
    });
    expect(await sk2.getPlugins()).toEqual([]);
  });
});

describe('discoverInventory', () => {
  it('builds the inventory, capabilities and plugin list', async () => {
    const result = await discoverInventory(sk);
    expect(result.paths).toHaveLength(19);
    expect(result.capabilities.hasWind).toBe(true);
    expect(result.capabilities.batteryCount).toBe(2);
    expect(result.plugins).toEqual([
      { id: 'anchoralarm', enabled: true },
      { id: 'freeboard-sk', enabled: false },
    ]);
  });
});

describe('callDiscoveryTool', () => {
  it('analyze_signalk_data returns capabilities and a path count', async () => {
    const result = (await callDiscoveryTool(sk, 'analyze_signalk_data')) as {
      pathCount: number;
      capabilities: { hasWind: boolean };
    };
    expect(result.pathCount).toBe(19);
    expect(result.capabilities.hasWind).toBe(true);
  });

  it('list_available_paths filters by prefix', async () => {
    const result = (await callDiscoveryTool(sk, 'list_available_paths', {
      prefix: 'environment.wind',
    })) as { paths: string[] };
    expect(result.paths).toHaveLength(4);
    expect(result.paths.every((p) => p.startsWith('environment.wind'))).toBe(true);
  });

  it('get_path_meta returns metadata for requested paths', async () => {
    const result = (await callDiscoveryTool(sk, 'get_path_meta', {
      paths: ['navigation.speedOverGround'],
    })) as { meta: Array<{ path: string; skUnit: string }> };
    expect(result.meta).toHaveLength(1);
    expect(result.meta[0].skUnit).toBe('m/s');
  });
});
