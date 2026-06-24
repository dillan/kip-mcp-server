import { readFileSync } from 'node:fs';

const read = (rel: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));

const pkg = read('../package.json');
const manifest = read('../server.json') as {
  name: string;
  description: string;
  version: string;
  packages: Array<{ registryType: string; identifier: string; version?: string }>;
};

describe('MCP registry manifest (server.json)', () => {
  it('server name matches package.json mcpName (the npm ownership proof)', () => {
    expect(manifest.name).toBe(pkg.mcpName);
  });

  it('the npm package entry identifies this package at the manifest version', () => {
    const npm = manifest.packages.find((p) => p.registryType === 'npm');
    expect(npm?.identifier).toBe(pkg.name);
    expect(npm?.version).toBe(manifest.version); // kept in lockstep by `npm run registry:sync`
  });

  it('declares the schema-required top-level fields', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.description).toBeTruthy();
    expect(manifest.version).toBeTruthy();
  });
});
