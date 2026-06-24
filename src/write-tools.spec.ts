import { SkClient } from './discovery/sk-client.js';
import { loadBundledSchema } from './schema/kip-schema.js';
import { callWriteTool } from './write-tools.js';
import { buildApplyPlan, supportsApplicationData } from './write/apply-plan.js';
import { SkAppDataClient } from './write/appdata-client.js';
import type { KipConfig } from './write/config-builder.js';

const schema = loadBundledSchema();
const dash = {
  id: 'd1',
  name: 'X',
  icon: 'dashboard-dashboard',
  collapseSplitShell: false,
  configuration: [],
};
const existingConfig: KipConfig = {
  app: {
    configVersion: 12,
    dataSets: [],
    unitDefaults: { Speed: 'knots' },
    notificationConfig: {},
  },
  theme: { themeName: 'night-theme' },
  dashboards: [{ id: 'old' }],
};

describe('supportsApplicationData', () => {
  it('requires Signal K >= 1.27', () => {
    expect(supportsApplicationData('2.13.0')).toBe(true);
    expect(supportsApplicationData('1.27.0')).toBe(true);
    expect(supportsApplicationData('1.26.5')).toBe(false);
  });
});

describe('buildApplyPlan', () => {
  it('seeds a full POST when no config exists', () => {
    const plan = buildApplyPlan({
      schema,
      dashboards: [dash],
      existing: null,
      configName: 'default',
      mode: 'append-dashboards',
    });
    expect(plan.requests[0].kind).toBe('post-full');
    expect(plan.errors).toEqual([]);
  });

  it('patches the merged dashboards when a config exists', () => {
    const plan = buildApplyPlan({
      schema,
      dashboards: [dash],
      existing: existingConfig,
      configName: 'default',
      mode: 'append-dashboards',
    });
    expect(plan.requests[0].kind).toBe('patch-dashboards');
    expect((plan.requests[0].body as unknown[]).length).toBe(2);
  });

  it('full-replace posts a full config keeping the existing theme', () => {
    const plan = buildApplyPlan({
      schema,
      dashboards: [dash],
      existing: existingConfig,
      configName: 'default',
      mode: 'full-replace',
    });
    expect(plan.requests[0].kind).toBe('post-full');
    expect((plan.requests[0].body as KipConfig).theme.themeName).toBe('night-theme');
  });
});

interface Captured {
  url: string;
  method?: string;
}

function makeAppData(routes: Record<string, unknown>, captured: Captured[]): SkAppDataClient {
  const fetchImpl = (async (url: unknown, init?: { method?: string }) => {
    captured.push({ url: String(url), method: init?.method });
    const u = String(url);
    for (const [path, body] of Object.entries(routes)) {
      if (u.includes(path)) return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
  return new SkAppDataClient({ baseUrl: 'http://boat:3000', fetchImpl });
}

const skWithVersion = (version: string): SkClient => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ server: { version } }), {
      status: 200,
    })) as unknown as typeof fetch;
  return new SkClient({ baseUrl: 'http://boat:3000', fetchImpl });
};

describe('callWriteTool apply_kip_config', () => {
  it('dry-runs by default and writes nothing', async () => {
    const captured: Captured[] = [];
    const appData = makeAppData({ '/user/kip/11': existingConfig }, captured);
    const result = (await callWriteTool(
      schema,
      appData,
      skWithVersion('2.13.0'),
      'apply_kip_config',
      {
        dashboards: [dash],
      },
    )) as { dryRun: boolean };
    expect(result.dryRun).toBe(true);
    expect(captured.some((c) => c.method === 'POST')).toBe(false);
  });

  it('writes when dryRun:false and confirm:true', async () => {
    const captured: Captured[] = [];
    const appData = makeAppData({ '/user/kip/11': existingConfig }, captured);
    const result = (await callWriteTool(
      schema,
      appData,
      skWithVersion('2.13.0'),
      'apply_kip_config',
      {
        dashboards: [dash],
        dryRun: false,
        confirm: true,
      },
    )) as { applied: boolean };
    expect(result.applied).toBe(true);
    expect(captured.some((c) => c.method === 'POST')).toBe(true);
  });

  it('refuses on Signal K older than 1.27', async () => {
    const appData = makeAppData({}, []);
    const result = (await callWriteTool(
      schema,
      appData,
      skWithVersion('1.26.0'),
      'apply_kip_config',
      {
        dashboards: [dash],
        dryRun: false,
        confirm: true,
      },
    )) as { refused: boolean };
    expect(result.refused).toBe(true);
  });
});
