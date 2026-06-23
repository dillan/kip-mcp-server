import type { ServerConfig } from './config.js';
import { SkClient } from './discovery/sk-client.js';
import { formatDoctorReport, runDoctor, type DoctorDeps } from './doctor.js';
import { loadBundledSchema } from './schema/kip-schema.js';
import type { LoadResult } from './schema/kip-schema.js';

const baseConfig: ServerConfig = {
  signalkBaseUrl: 'http://boat:3000',
  kipBaseUrl: 'http://boat:3000/@mxtommy/kip/',
};

function skWith(routes: (url: string) => { status: number; body: unknown }): SkClient {
  const fetchImpl = (async (url: unknown) => {
    const { status, body } = routes(String(url));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return new SkClient({ baseUrl: 'http://boat:3000', fetchImpl });
}

const remoteSchema = async (): Promise<LoadResult> => ({
  schema: loadBundledSchema(),
  source: 'remote',
});
const bundledSchema = async (): Promise<LoadResult> => ({
  schema: loadBundledSchema(),
  source: 'bundled',
  warning: 'Could not reach KIP; using the bundled schema for KIP 4.8.0',
});

const okSk = (): SkClient => skWith(() => ({ status: 200, body: { server: { version: '2.13.0' } } }));

function deps(overrides: Partial<DoctorDeps>): DoctorDeps {
  return { config: baseConfig, sk: okSk(), loadSchema: remoteSchema, ...overrides };
}

const sev = (report: { checks: { id: string; severity: string }[] }, id: string): string | undefined =>
  report.checks.find((c) => c.id === id)?.severity;

describe('runDoctor', () => {
  it('reports all green when server, version, schema and anonymous access are fine', async () => {
    const report = await runDoctor(deps({}));
    expect(report.ok).toBe(true);
    expect(sev(report, 'signalk_reachable')).toBe('pass');
    expect(sev(report, 'applicationdata_supported')).toBe('pass');
    expect(sev(report, 'kip_schema_served')).toBe('pass');
    expect(sev(report, 'auth_ok')).toBe('pass');
  });

  it('fails and skips downstream server checks when the server is unreachable', async () => {
    const sk = skWith(() => {
      throw new Error('ECONNREFUSED');
    });
    const report = await runDoctor(deps({ sk, config: { ...baseConfig, token: 'abc' } }));
    expect(report.ok).toBe(false);
    expect(sev(report, 'signalk_reachable')).toBe('fail');
    expect(sev(report, 'applicationdata_supported')).toBe('skip');
    expect(sev(report, 'auth_ok')).toBe('skip');
  });

  it('warns when the Signal K version is below 1.27', async () => {
    const sk = skWith(() => ({ status: 200, body: { server: { version: '1.26.0' } } }));
    const report = await runDoctor(deps({ sk }));
    expect(sev(report, 'applicationdata_supported')).toBe('warn');
    expect(report.ok).toBe(true);
  });

  it('warns when the KIP schema falls back to the bundled copy', async () => {
    const report = await runDoctor(deps({ loadSchema: bundledSchema }));
    expect(sev(report, 'kip_schema_served')).toBe('warn');
    expect(report.ok).toBe(true);
  });

  it('fails auth when credentials are set but rejected', async () => {
    const sk = skWith((url) =>
      url.includes('/vessels/self')
        ? { status: 401, body: 'no' }
        : { status: 200, body: { server: { version: '2.13.0' } } },
    );
    const report = await runDoctor(deps({ sk, config: { ...baseConfig, token: 'bad' } }));
    expect(sev(report, 'auth_ok')).toBe('fail');
    expect(report.ok).toBe(false);
  });

  it('passes auth as anonymous when no credentials are set', async () => {
    const report = await runDoctor(deps({}));
    expect(sev(report, 'auth_ok')).toBe('pass');
  });
});

describe('formatDoctorReport', () => {
  it('renders a readable line per check with guidance for problems', () => {
    const text = formatDoctorReport({
      ok: false,
      checks: [
        { id: 'a', label: 'Server reachable', severity: 'pass', detail: 'Signal K 2.13.0' },
        { id: 'b', label: 'Auth', severity: 'fail', detail: 'rejected', guidance: 'set a token' },
      ],
      summary: '1 problem',
    });
    expect(text).toContain('Server reachable');
    expect(text).toContain('Signal K 2.13.0');
    expect(text).toContain('set a token');
  });
});
