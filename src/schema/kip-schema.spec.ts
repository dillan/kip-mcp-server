import { loadBundledSchema, loadKipSchema } from './kip-schema.js';
import type { KipDashboardSchema } from './schema-types.js';

const sampleRemote: KipDashboardSchema = {
  meta: { schemaVersion: 1, kipVersion: '9.9.9', configFileVersion: 11, configVersion: 12 },
  widgets: [],
  designSystem: {
    grid: { column: 24, row: 24, margin: 4, float: true, cellHeight: 'auto' },
    colors: [],
    themeNames: [],
    icons: [],
    unitGroups: [],
  },
};
const bundled: KipDashboardSchema = {
  ...sampleRemote,
  meta: { ...sampleRemote.meta, kipVersion: '1.0.0' },
};

const asFetch = (impl: (url: string) => Promise<Response>): typeof fetch =>
  ((url: unknown) => impl(String(url))) as unknown as typeof fetch;

const base = 'http://boat.local/@mxtommy/kip/';

describe('loadKipSchema', () => {
  it('uses the live schema served by KIP when available', async () => {
    const fetchImpl = asFetch(
      async () => new Response(JSON.stringify(sampleRemote), { status: 200 }),
    );
    const result = await loadKipSchema({ baseUrl: base, fetchImpl, loadBundled: () => bundled });
    expect(result.source).toBe('remote');
    expect(result.schema.meta.kipVersion).toBe('9.9.9');
  });

  it('falls back to the bundled schema with a warning on 404', async () => {
    const fetchImpl = asFetch(async () => new Response('not found', { status: 404 }));
    const result = await loadKipSchema({ baseUrl: base, fetchImpl, loadBundled: () => bundled });
    expect(result.source).toBe('bundled');
    expect(result.schema.meta.kipVersion).toBe('1.0.0');
    expect(result.warning).toBeDefined();
  });

  it('falls back to the bundled schema when KIP is unreachable', async () => {
    const fetchImpl = asFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const result = await loadKipSchema({ baseUrl: base, fetchImpl, loadBundled: () => bundled });
    expect(result.source).toBe('bundled');
    expect(result.warning).toBeDefined();
  });

  it('throws an actionable auth error on 401 (no silent fallback)', async () => {
    const fetchImpl = asFetch(async () => new Response('unauthorized', { status: 401 }));
    await expect(
      loadKipSchema({ baseUrl: base, fetchImpl, loadBundled: () => bundled }),
    ).rejects.toThrow(/auth|token|credential/i);
  });

  it('requests the schema asset under the KIP base URL', async () => {
    const calls: string[] = [];
    const fetchImpl = asFetch(async (url) => {
      calls.push(url);
      return new Response(JSON.stringify(sampleRemote), { status: 200 });
    });
    await loadKipSchema({ baseUrl: base, fetchImpl, loadBundled: () => bundled });
    expect(calls[0]).toBe('http://boat.local/@mxtommy/kip/assets/kip-dashboard-schema.json');
  });
});

describe('loadBundledSchema', () => {
  it('reads the shipped fallback schema', () => {
    const schema = loadBundledSchema();
    expect(schema.widgets.length).toBeGreaterThanOrEqual(30);
    expect(schema.designSystem.grid.column).toBe(24);
  });
});
