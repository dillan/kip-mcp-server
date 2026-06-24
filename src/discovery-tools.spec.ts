import { readFileSync } from 'node:fs';
import { callDiscoveryTool } from './discovery-tools.js';
import { SkClient } from './discovery/sk-client.js';

const self = JSON.parse(
  readFileSync(new URL('./discovery/fixtures/sailboat-self.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

// A Signal K client whose every request returns the sailboat fixture (19 leaf paths).
const sk = (): SkClient =>
  new SkClient({
    baseUrl: 'http://boat:3000',
    fetchImpl: (async () =>
      new Response(JSON.stringify(self), { status: 200 })) as unknown as typeof fetch,
  });

type PathsResult = { paths: string[]; nextCursor?: string };

describe('list_available_paths pagination', () => {
  it('returns every path with no cursor when no limit is given', async () => {
    const r = (await callDiscoveryTool(sk(), 'list_available_paths', {})) as PathsResult;
    expect(r.paths).toHaveLength(19);
    expect(r.nextCursor).toBeUndefined();
  });

  it('pages with limit + nextCursor, covering every path exactly once', async () => {
    const first = (await callDiscoveryTool(sk(), 'list_available_paths', {
      limit: 10,
    })) as PathsResult;
    expect(first.paths).toHaveLength(10);
    expect(first.nextCursor).toBeDefined();

    const second = (await callDiscoveryTool(sk(), 'list_available_paths', {
      cursor: first.nextCursor,
    })) as PathsResult;
    expect(second.nextCursor).toBeUndefined();

    const all = [...first.paths, ...second.paths];
    expect(all).toHaveLength(19);
    expect(new Set(all).size).toBe(19); // no overlap between pages
  });

  it('applies the limit after the prefix filter', async () => {
    const r = (await callDiscoveryTool(sk(), 'list_available_paths', {
      prefix: 'navigation',
      limit: 2,
    })) as PathsResult;
    expect(r.paths.length).toBeLessThanOrEqual(2);
    expect(r.paths.every((p) => p.startsWith('navigation'))).toBe(true);
  });

  it('rejects a malformed cursor', async () => {
    await expect(
      callDiscoveryTool(sk(), 'list_available_paths', { cursor: 'bogus!!' }),
    ).rejects.toThrow(/cursor/i);
  });
});

describe('analyze_signalk_data pagination', () => {
  it('paginates the paths but still reports the full pathCount', async () => {
    const r = (await callDiscoveryTool(sk(), 'analyze_signalk_data', { limit: 5 })) as {
      paths: unknown[];
      pathCount: number;
      nextCursor?: string;
    };
    expect(r.paths).toHaveLength(5);
    expect(r.pathCount).toBe(19); // total, not the page size
    expect(r.nextCursor).toBeDefined();
  });
});
