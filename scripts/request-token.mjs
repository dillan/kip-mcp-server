#!/usr/bin/env node
/**
 * Requests a long-lived Signal K access token for kip-mcp-server using the
 * device Access Request flow, then prints it for use as SIGNALK_TOKEN.
 *
 * You approve the request once, in the Signal K admin UI under
 * Security -> Access Requests (grant write permission so the assistant can save
 * dashboards). The token the server then issues is durable — set it as
 * SIGNALK_TOKEN and you never put a password in the environment.
 *
 *   npm run signalk:request-token            # uses SIGNALK_HOST/PORT/TLS, like the server
 *   SIGNALK_HOST=my-boat npm run signalk:request-token
 *
 * Prefer not to approve anything? Use SIGNALK_USER + SIGNALK_PASSWORD instead and
 * the server logs in for you. See docs/signalk-auth.md.
 */
import { randomUUID } from 'node:crypto';

const tls = (process.env.SIGNALK_TLS ?? '').toLowerCase() === 'true';
const host = process.env.SIGNALK_HOST || 'localhost';
const port = process.env.SIGNALK_PORT || '3000';
const base = `${tls ? 'https' : 'http'}://${host}:${port}`;
const description = process.env.npm_config_description || 'kip-mcp-server';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const clientId = randomUUID();
  console.log(`[signalk] requesting access from ${base} (clientId ${clientId})…`);

  const res = await fetch(`${base}/signalk/v1/access/requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId, description }),
  });
  if (!res.ok) {
    throw new Error(
      `The server would not accept an access request (HTTP ${res.status}). Either device access ` +
        `requests are disabled (turn on Security > "Allow New Device Registration"), or security is ` +
        `off (no token needed). Alternatives: run \`signalk-generate-token\` on the server, or set ` +
        `SIGNALK_USER and SIGNALK_PASSWORD instead. See docs/signalk-auth.md.`,
    );
  }
  const created = await res.json().catch(() => ({}));
  if (!created.href) {
    throw new Error(`Unexpected response creating the request: ${JSON.stringify(created)}`);
  }
  const pollUrl = created.href.startsWith('http') ? created.href : `${base}${created.href}`;

  console.log('\n👉 Approve this request in the Signal K admin UI now:');
  console.log('   Security → Access Requests → approve, granting WRITE permission.\n');
  process.stdout.write('   waiting for approval');

  const deadline = Date.now() + 10 * 60 * 1000; // 10 minutes
  for (;;) {
    await sleep(3000);
    const body = await fetch(pollUrl)
      .then((r) => r.json())
      .catch(() => ({}));

    if (body.state === 'COMPLETED') {
      const ar = body.accessRequest ?? {};
      if (ar.permission && ar.permission !== 'DENIED' && ar.token) {
        console.log('\n\n✅ Approved. Set this and kip-mcp-server can write dashboards:\n');
        console.log(`   SIGNALK_TOKEN=${ar.token}\n`);
        if (ar.expirationTime) console.log(`   (expires ${ar.expirationTime})`);
        return;
      }
      throw new Error(
        `the request was ${ar.permission === 'DENIED' ? 'denied' : 'not granted a token'}.`,
      );
    }
    if (Date.now() > deadline) throw new Error('timed out waiting for approval (10 minutes).');
    process.stdout.write('.');
  }
}

main().catch((error) => {
  console.error(`\n[signalk] ${error.message}`);
  process.exitCode = 1;
});
