// End-to-end test: stand up a real Signal K server in Docker, seed it with
// vessel data, then drive the COMPILED stdio server over MCP exactly as a real
// client would — discover the boat, compose a dashboard, write it to the server,
// and read it back. Proves the whole built binary works against a live Signal K,
// not just the in-process unit tests.
//
// Run with: npm run test:e2e   (needs Docker + a built dist/, i.e. `npm run build`).
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const HOST = 'localhost';
const PORT = 3456;
const BASE = `http://${HOST}:${PORT}`;
// The admin user baked into the e2e image (tests/e2e/) — throwaway test creds.
const CREDS = { username: 'e2e', password: 'e2epass' };
const COMPOSE = ['compose', '-f', 'docker-compose.e2e.yml'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const compose = (args) => execFileSync('docker', [...COMPOSE, ...args], { stdio: 'inherit' });

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function waitFor(label, fn, { tries = 60, delayMs = 2000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      if (await fn()) return;
    } catch {
      /* keep polling */
    }
    await sleep(delayMs);
  }
  throw new Error(`timed out waiting for ${label}`);
}

// Vessel data the test injects, and the paths it then expects to discover.
const SEED_VALUES = [
  { path: 'navigation.position', value: { latitude: 48.1, longitude: -4.5 } },
  { path: 'navigation.speedOverGround', value: 3.2 },
  { path: 'navigation.headingTrue', value: 1.5 },
  { path: 'navigation.courseOverGroundTrue', value: 1.4 },
  { path: 'environment.depth.belowTransducer', value: 8.4 },
  { path: 'environment.wind.speedApparent', value: 6.0 },
  { path: 'environment.wind.angleApparent', value: 0.7 },
  { path: 'electrical.batteries.house.voltage', value: 12.6 },
];

async function login() {
  const res = await fetch(`${BASE}/signalk/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(CREDS),
  });
  if (!res.ok) throw new Error(`login failed (HTTP ${res.status})`);
  const { token } = await res.json();
  if (!token) throw new Error('login returned no token');
  return token;
}

async function seedVesselData(token) {
  const ws = new WebSocket(`ws://${HOST}:${PORT}/signalk/v1/stream?subscribe=none&token=${token}`);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timed out')), 15000);
    ws.addEventListener(
      'open',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    ws.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new Error('WebSocket error'));
      },
      { once: true },
    );
  });
  ws.send(JSON.stringify({ updates: [{ source: { label: 'e2e-seed' }, values: SEED_VALUES }] }));
  await sleep(1000);
  ws.close();
}

async function selfHasSpeed() {
  const res = await fetch(`${BASE}/signalk/v1/api/vessels/self`);
  if (!res.ok) return false;
  const self = await res.json();
  return self?.navigation?.speedOverGround?.value !== undefined;
}

async function run() {
  // 1. Server up and reachable.
  await waitFor('Signal K server', async () => (await fetch(`${BASE}/signalk`)).ok);
  console.log('  ✓ Signal K server reachable');

  // 2. Log in and seed vessel data; confirm it landed in the model.
  const token = await login();
  console.log('  ✓ logged in to Signal K');
  await seedVesselData(token);
  await waitFor('seeded vessel data', selfHasSpeed, { tries: 30, delayMs: 1000 });
  console.log('  ✓ vessel data seeded');

  // 3. Drive the COMPILED stdio server over MCP, pointed at the container. It
  //    logs in with the same credentials (exercising the username/password path).
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      ...process.env,
      SIGNALK_HOST: HOST,
      SIGNALK_PORT: String(PORT),
      SIGNALK_TLS: 'false',
      SIGNALK_USER: CREDS.username,
      SIGNALK_PASSWORD: CREDS.password,
    },
  });
  const client = new Client({ name: 'e2e', version: '0.0.0' });
  await client.connect(transport);

  try {
    const sc = async (name, args = {}) =>
      (await client.callTool({ name, arguments: args })).structuredContent;

    // Real server version from the container (not the bundled fallback's 'unknown').
    const info = await sc('get_server_info');
    assert(
      typeof info.version === 'string' && info.version !== 'unknown',
      `live server version ${info.version}`,
    );

    // Discovery sees the data we seeded.
    const analysis = await sc('analyze_signalk_data');
    assert(analysis.pathCount > 0, `discovered ${analysis.pathCount} paths`);
    const paths = (analysis.paths ?? []).map((p) => p.path);
    assert(paths.includes('navigation.speedOverGround'), 'discovered navigation.speedOverGround');
    assert(paths.includes('environment.depth.belowTransducer'), 'discovered depth');

    // Compose a dashboard from the live inventory.
    const composed = await sc('compose_dashboard', { intent: 'general' });
    const dashboard = composed.dashboard;
    assert(
      dashboard?.configuration?.length > 0,
      `composed dashboard with ${dashboard.configuration.length} widgets`,
    );

    // Write it to the server (the real applicationData round-trip).
    const applied = await sc('apply_kip_config', {
      dashboards: [dashboard],
      dryRun: false,
      confirm: true,
    });
    assert(
      applied.applied === true,
      `apply_kip_config wrote the dashboard (${JSON.stringify(applied.wrote ?? applied.errors ?? applied)})`,
    );

    // Read it back: the write persisted on the server.
    const readback = await sc('read_kip_config');
    assert(readback.exists === true, 'read_kip_config finds the stored config');
    assert(
      JSON.stringify(readback.config ?? {}).includes(dashboard.id),
      `stored config contains the composed dashboard (id ${dashboard.id})`,
    );
  } finally {
    await client.close();
  }

  console.log(
    '\nE2E OK — built server discovered, composed, wrote, and read back a dashboard against a live Signal K.',
  );
}

console.log('[e2e] starting Signal K (docker compose up --build)…');
try {
  compose(['up', '-d', '--build']);
  await run();
} catch (error) {
  console.error('\nE2E FAILED:', error.message);
  process.exitCode = 1;
} finally {
  console.log('[e2e] tearing down (docker compose down -v)…');
  try {
    compose(['down', '-v']);
  } catch {
    /* best-effort teardown */
  }
}
