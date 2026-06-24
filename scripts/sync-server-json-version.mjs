#!/usr/bin/env node
/**
 * Sets server.json's version to the latest version published on npm, so the MCP
 * registry manifest matches the actual artifact before `mcp-publisher publish`.
 *
 * package.json keeps the `0.0.0-development` placeholder (semantic-release sets
 * the real version only at publish), so the truth lives on npm — run this right
 * before publishing to the registry.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const pkgName = 'kip-mcp-server';
const version = execSync(`npm view ${pkgName} version`, { encoding: 'utf8' }).trim();
if (!/^\d+\.\d+\.\d+/.test(version)) {
  throw new Error(`Unexpected version from npm for ${pkgName}: "${version}"`);
}

const path = new URL('../server.json', import.meta.url);
const manifest = JSON.parse(readFileSync(path, 'utf8'));
manifest.version = version;
for (const pkg of manifest.packages ?? []) {
  if (pkg.registryType === 'npm') pkg.version = version;
}
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`server.json version set to ${version} (latest published ${pkgName}).`);
