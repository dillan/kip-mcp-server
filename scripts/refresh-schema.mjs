// Refreshes the bundled KIP schema snapshot from a running KIP server.
//
// At runtime the server prefers the *live* schema served by your installed KIP
// and only falls back to the bundled snapshot in src/resources/bundled-schema.json
// when KIP can't be reached. Run this when KIP changes so that fallback stays
// current:
//
//   SIGNALK_HOST=my-boat npm run schema:refresh
//   KIP_URL=http://my-boat:3000/@mxtommy/kip/ npm run schema:refresh
//
// Then run `npm run ci` and commit the updated snapshot.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_ASSET = 'assets/kip-dashboard-schema.json';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundledPath = join(root, 'src', 'resources', 'bundled-schema.json');

// Mirrors src/config.ts so the script targets the same KIP URL as the server.
function kipBaseUrl(env) {
  const override = env.KIP_URL?.trim();
  if (override) return override.endsWith('/') ? override : `${override}/`;
  const host = env.SIGNALK_HOST?.trim() || 'localhost';
  const port = env.SIGNALK_PORT?.trim() || '3000';
  const protocol = env.SIGNALK_TLS === 'true' ? 'https' : 'http';
  return `${protocol}://${host}:${port}/@mxtommy/kip/`;
}

// Recursively sorts object keys (leaving array order alone) so successive
// snapshots diff cleanly even if KIP serves keys in a different order.
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

function currentVersion() {
  try {
    return JSON.parse(readFileSync(bundledPath, 'utf8'))?.meta?.kipVersion ?? '(none)';
  } catch {
    return '(none)';
  }
}

const base = kipBaseUrl(process.env);
const url = new URL(SCHEMA_ASSET, base).toString();
const token = process.env.SIGNALK_TOKEN?.trim();

console.log(`Fetching KIP schema from ${url} ...`);
let response;
try {
  response = await fetch(url, token ? { headers: { authorization: `JWT ${token}` } } : undefined);
} catch (error) {
  console.error(`Could not reach KIP at ${url}: ${error instanceof Error ? error.message : error}`);
  console.error('Set SIGNALK_HOST/SIGNALK_PORT (or KIP_URL) to point at your running KIP.');
  process.exit(1);
}

if (!response.ok) {
  console.error(`KIP returned HTTP ${response.status} for ${url}.`);
  if (response.status === 401 || response.status === 403) {
    console.error('Set SIGNALK_TOKEN to a valid token — KIP requires auth for this asset.');
  }
  process.exit(1);
}

const schema = await response.json();
const looksValid =
  schema?.meta?.kipVersion &&
  Array.isArray(schema.widgets) &&
  schema.widgets.length > 0 &&
  schema.designSystem;
if (!looksValid) {
  console.error(
    'The fetched schema is missing meta.kipVersion, widgets, or designSystem; not writing.',
  );
  process.exit(1);
}

const before = currentVersion();
writeFileSync(bundledPath, `${JSON.stringify(sortKeys(schema), null, 2)}\n`);
console.log(`Wrote ${bundledPath}`);
console.log(`KIP version: ${before} -> ${schema.meta.kipVersion}`);
console.log(`Widgets: ${schema.widgets.length}`);
console.log('Next: run `npm run ci`, then commit the updated snapshot.');
