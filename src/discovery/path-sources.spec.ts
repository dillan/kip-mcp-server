/**
 * RED-first tests for SF1: per-path source discovery.
 *
 * These fail on purpose until `inventory.toPathInfo` preserves the source ids
 * and the active (`$source`) source, and until the `get_path_sources` discovery
 * tool is wired into `callDiscoveryTool`.
 */
import { readFileSync } from 'node:fs';
import { callDiscoveryTool } from '../discovery-tools.js';
import { flattenVesselData, type PathInfo } from './inventory.js';
import { SkClient } from './sk-client.js';

const self = JSON.parse(
  readFileSync(new URL('./fixtures/sailboat-self.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const find = (p: string): PathInfo | undefined => flattenVesselData(self).find((x) => x.path === p);

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

const sk = new SkClient({
  baseUrl: 'http://boat.local:3000',
  fetchImpl: fakeFetch({ '/signalk/v1/api/vessels/self': { body: self } }),
});

describe('inventory source projection', () => {
  it('lists every reporting source from the values map', () => {
    expect(find('navigation.speedOverGround')?.sources).toEqual(['gps.0', 'gps.1']);
  });

  it('reports the active ($source) source', () => {
    expect(find('navigation.speedOverGround')?.defaultSource).toBe('gps.0');
  });

  it('falls back to the single active source when there is no values map', () => {
    const depth = find('environment.depth.belowTransducer');
    expect(depth?.sources).toEqual(['dst.0']);
    expect(depth?.defaultSource).toBe('dst.0');
    expect(depth?.sourceCount).toBe(1);
  });

  it('keeps sourceCount aligned with the source list', () => {
    expect(find('navigation.speedOverGround')?.sourceCount).toBe(2);
    expect(find('navigation.headingTrue')?.sourceCount).toBe(1);
  });
});

describe('get_path_sources tool', () => {
  it('returns sources and the active source for the requested paths', async () => {
    const result = (await callDiscoveryTool(sk, 'get_path_sources', {
      paths: ['navigation.speedOverGround', 'environment.depth.belowTransducer'],
    })) as {
      sources: Array<{
        path: string;
        defaultSource: string | null;
        sources: string[];
        sourceCount: number;
      }>;
    };

    // Rows follow the inventory's stable sorted order, like get_path_meta.
    expect(result.sources).toEqual([
      {
        path: 'environment.depth.belowTransducer',
        defaultSource: 'dst.0',
        sources: ['dst.0'],
        sourceCount: 1,
      },
      {
        path: 'navigation.speedOverGround',
        defaultSource: 'gps.0',
        sources: ['gps.0', 'gps.1'],
        sourceCount: 2,
      },
    ]);
  });

  it('ignores paths that the vessel does not report', async () => {
    const result = (await callDiscoveryTool(sk, 'get_path_sources', {
      paths: ['navigation.speedOverGround', 'does.not.exist'],
    })) as { sources: Array<{ path: string }> };

    expect(result.sources.map((r) => r.path)).toEqual(['navigation.speedOverGround']);
  });

  it('returns an empty list when no paths are requested', async () => {
    const result = (await callDiscoveryTool(sk, 'get_path_sources', { paths: [] })) as {
      sources: unknown[];
    };
    expect(result.sources).toEqual([]);
  });
});
