import { readFileSync } from 'node:fs';
import { callComposeTool } from './compose-tools.js';
import { SkClient } from './discovery/sk-client.js';
import { loadBundledSchema } from './schema/kip-schema.js';

const schema = loadBundledSchema();
const self = JSON.parse(
  readFileSync(new URL('./discovery/fixtures/sailboat-self.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (url: unknown) => {
    const u = String(url);
    for (const [path, body] of Object.entries(routes)) {
      if (u.endsWith(path)) return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
}

const sk = new SkClient({
  baseUrl: 'http://boat.local:3000',
  fetchImpl: fakeFetch({
    '/signalk': { server: { version: '2.13.0' } },
    '/signalk/v1/api/vessels/self': self,
    '/skServer/plugins': [],
  }),
});

describe('callComposeTool', () => {
  it('compose_dashboard designs a dashboard with a preview', async () => {
    const result = (await callComposeTool(schema, sk, 'compose_dashboard', {
      intent: 'general',
    })) as {
      dashboard: { configuration: unknown[]; name: string };
      preview: string;
    };
    expect(result.dashboard.configuration).toHaveLength(5);
    expect(result.dashboard.name).toBe('Overview');
    expect(typeof result.preview).toBe('string');
  });

  it('compose_dashboard rejects an unknown intent', async () => {
    await expect(
      callComposeTool(schema, sk, 'compose_dashboard', { intent: 'nope' }),
    ).rejects.toThrow(/Unknown intent/);
  });

  it('recommend_dashboard_set returns the supported dashboards', async () => {
    const result = (await callComposeTool(schema, sk, 'recommend_dashboard_set', {})) as {
      dashboards: Array<{ intent: string }>;
    };
    expect(result.dashboards.length).toBeGreaterThan(0);
    expect(result.dashboards.some((d) => d.intent === 'general')).toBe(true);
  });
});
