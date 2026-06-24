// Built-artifact smoke test for the optional Streamable HTTP transport.
//
// Spawns the COMPILED bin (dist/http-server.js) on loopback with a bearer token —
// the only safe topology the refuse-to-start guard allows without
// MCP_ALLOW_INSECURE — then drives it with a real MCP Client over
// StreamableHTTPClientTransport exactly as a hosted assistant (Claude.ai) would:
// initialize, list tools, call a tool. It also asserts that a request WITHOUT the
// bearer token is rejected with 401, and that a non-loopback bind with no token
// refuses to start. Finally it SIGTERMs the child and confirms a clean exit.
//
// This catches packaging/transport breakage that the in-process unit tests cannot.
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const PORT = 31573;
const TOKEN = 'smoke-test-token';
const BASE = `http://127.0.0.1:${PORT}`;
const MCP_URL = `${BASE}/mcp`;

function fail(message, extra) {
  console.error('SMOKE HTTP FAILED:', message);
  if (extra) console.error(extra);
  process.exit(1);
}

// 1. Refuse-to-start, each unsafe condition proven on its own (no
//    MCP_ALLOW_INSECURE). The guard must exit non-zero before listening.
function assertRefuses(label, env) {
  const r = spawnSync('node', ['dist/http-server.js'], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, MCP_ALLOW_INSECURE: '', ...env },
  });
  if (r.status === 0) fail(`expected ${label} to refuse to start (non-zero exit)`);
  if (!`${r.stderr ?? ''}`.includes('Refusing to start')) {
    fail(`${label}: refuse-to-start did not print the expected message`, r.stderr);
  }
}
// a) Non-loopback bind, even WITH a token.
assertRefuses('a non-loopback bind', { HTTP_HOST: '0.0.0.0', MCP_BEARER_TOKEN: 'tok' });
// b) Loopback bind but NO token.
assertRefuses('a loopback bind without a token', {
  HTTP_HOST: '127.0.0.1',
  MCP_BEARER_TOKEN: '',
});

// 2. Start the server on loopback with a bearer token (the safe topology).
const child = spawn('node', ['dist/http-server.js'], {
  env: {
    ...process.env,
    HTTP_HOST: '127.0.0.1',
    HTTP_PORT: String(PORT),
    MCP_BEARER_TOKEN: TOKEN,
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});

let exited = false;
let exitInfo = null;
child.on('exit', (code, signal) => {
  exited = true;
  exitInfo = { code, signal };
});

async function shutdownAndExit(ok) {
  if (!exited) {
    child.kill('SIGTERM');
    // Give the graceful shutdown a moment to run.
    for (let i = 0; i < 50 && !exited; i++) await delay(100);
    if (!exited) child.kill('SIGKILL');
  }
  if (ok) {
    console.log(
      'SMOKE HTTP OK — refuse-to-start, healthz, 401 without token, MCP over HTTP all pass',
    );
    process.exit(0);
  } else {
    process.exit(1);
  }
}

try {
  // Wait for the listener to come up by polling the unauthenticated health check.
  let healthy = false;
  for (let i = 0; i < 50; i++) {
    if (exited) fail('server exited during startup', exitInfo);
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.status === 200) {
        const body = await res.json();
        if (body.status === 'ok') {
          healthy = true;
          break;
        }
      }
    } catch {
      /* not up yet */
    }
    await delay(100);
  }
  if (!healthy) fail('server did not become healthy on /healthz');

  // 3. A request to the MCP endpoint WITHOUT a bearer token must be 401, with a
  //    WWW-Authenticate challenge pointing at the resource metadata.
  const noAuth = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  if (noAuth.status !== 401) {
    fail(`expected 401 without a bearer token, got ${noAuth.status}`);
  }
  if (!(noAuth.headers.get('www-authenticate') ?? '').includes('resource_metadata')) {
    fail('401 did not carry a WWW-Authenticate: Bearer resource_metadata challenge');
  }

  // 4. The protected-resource metadata is public so the 401 is discoverable.
  const meta = await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`);
  if (meta.status !== 200) fail(`expected resource metadata 200, got ${meta.status}`);
  const metaBody = await meta.json();
  if (metaBody.resource !== MCP_URL) {
    fail(`resource metadata advertised the wrong resource: ${metaBody.resource}`);
  }
  if (
    !Array.isArray(metaBody.scopes_supported) ||
    !metaBody.scopes_supported.includes('kip:design')
  ) {
    fail('resource metadata did not advertise the kip:design scope', JSON.stringify(metaBody));
  }

  // 5. Drive a real MCP session over HTTP with the bearer token.
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { authorization: `Bearer ${TOKEN}` } },
  });
  const client = new Client({ name: 'smoke-http', version: '0.0.0' });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  if (!names.includes('list_kip_widgets')) {
    fail(`expected list_kip_widgets in the tool list, got: ${names.join(', ')}`);
  }
  const widgets = tools.find((t) => t.name === 'list_kip_widgets');
  if (!widgets?.outputSchema || widgets.annotations?.readOnlyHint !== true) {
    fail('list_kip_widgets is missing its output schema or read-only annotation over HTTP');
  }

  // A fully offline tool — reads the bundled context, no Signal K needed.
  const result = await client.callTool({ name: 'get_kip_initial_context', arguments: {} });
  const text = result.content?.[0]?.text ?? '';
  if (!text.includes('KIP')) {
    fail('get_kip_initial_context did not return the expected overview over HTTP');
  }
  if (typeof result.structuredContent?.overview !== 'string') {
    fail('get_kip_initial_context did not return structured content over HTTP');
  }

  await client.close();
  await transport.close();

  console.log(`SMOKE HTTP — ${names.length} tools over HTTP: ${names.join(', ')}`);
  await shutdownAndExit(true);
} catch (error) {
  console.error('SMOKE HTTP error:', error);
  await shutdownAndExit(false);
}
