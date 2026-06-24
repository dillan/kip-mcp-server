/**
 * Configuration for the optional remote HTTP server, parsed from environment
 * variables.
 *
 * Kept separate from the listener (http-server.ts) and from the stdio config
 * (src/config.ts) so the safety-critical logic — the refuse-to-start guard and the
 * Host/Origin allowlist derivation — is plain, dependency-light, and unit-testable
 * without standing up a real HTTP server or loading the SDK transport. The stdio
 * path is completely unaffected by these settings.
 */
import type { SecurityConfig } from './security.js';
import {
  buildProtectedResourceMetadata,
  resourceMetadataPathFor,
  resourceMetadataUrlFor,
  type ProtectedResourceMetadata,
} from './resource-metadata.js';

export interface HttpServerConfig {
  listenHost: string;
  port: number;
  mcpPath: string;
  publicUrl: string;
  /** Local path the listener serves the resource metadata at (derived from mcpPath). */
  metadataPath: string;
  security: SecurityConfig;
  metadata: ProtectedResourceMetadata;
}

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

export function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Build the HTTP config from environment variables, refusing to start in an
 * unsafe topology. Exits the process (loudly) rather than silently exposing boat
 * data and write tools.
 */
export function loadHttpConfig(env: NodeJS.ProcessEnv = process.env): HttpServerConfig {
  const listenHost = env.HTTP_HOST?.trim() || '127.0.0.1';
  const rawPort = env.HTTP_PORT?.trim() || '3017';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error(`HTTP_PORT must be a number between 1 and 65535, got "${rawPort}".`);
  }
  const port = Number(rawPort);
  const mcpPath = env.HTTP_PATH?.trim() || '/mcp';
  const bearerTokens = splitList(env.MCP_BEARER_TOKEN);
  const allowInsecure = env.MCP_ALLOW_INSECURE === 'true';

  // Host names are case-insensitive, so LOCALHOST/Localhost are loopback too.
  const isLoopback = LOOPBACK.has(listenHost.toLowerCase());
  const problems: string[] = [];
  if (!isLoopback) {
    problems.push(
      `HTTP_HOST is set to a non-loopback address (${listenHost}). The server expects ` +
        `to sit behind a reverse proxy on loopback; binding it directly to a public ` +
        `interface exposes live boat data and the KIP write tools.`,
    );
  }
  if (bearerTokens.length === 0) {
    problems.push('MCP_BEARER_TOKEN is not set, so the endpoint would be unauthenticated.');
  }
  if (problems.length > 0 && !allowInsecure) {
    console.error(
      '[kip-mcp-http] Refusing to start in an unsafe configuration:\n' +
        problems.map((p) => `  - ${p}`).join('\n') +
        '\nFix the configuration, or set MCP_ALLOW_INSECURE=true if you understand the ' +
        'risk (e.g. a trusted private network for testing).',
    );
    process.exit(1);
  }
  if (problems.length > 0) {
    console.error(
      '[kip-mcp-http] WARNING: starting in an unsafe configuration (MCP_ALLOW_INSECURE=true):\n' +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
  }

  // A bare IPv6 literal (e.g. ::1) must be bracketed to form a valid URL/host.
  const hostForUrl =
    listenHost.includes(':') && !listenHost.startsWith('[') ? `[${listenHost}]` : listenHost;
  const publicUrl = env.MCP_PUBLIC_URL?.trim() || `http://${hostForUrl}:${port}${mcpPath}`;

  const allowedHosts = splitList(env.MCP_ALLOWED_HOSTS);
  if (allowedHosts.length === 0) {
    // Default: the public host plus loopback forms. Add both the host (with port,
    // if any) and the bare hostname, because a reverse proxy may forward the Host
    // header either with or without the port depending on its own listen port.
    try {
      const url = new URL(publicUrl);
      allowedHosts.push(url.host);
      if (url.hostname !== url.host) {
        allowedHosts.push(url.hostname);
      }
    } catch {
      /* ignore an unparseable public URL; loopback still covers local use */
    }
    allowedHosts.push(
      '127.0.0.1',
      'localhost',
      `127.0.0.1:${port}`,
      `localhost:${port}`,
      // IPv6 loopback, both bracketed forms a client may send.
      '[::1]',
      `[::1]:${port}`,
    );
  }

  const security: SecurityConfig = {
    bearerTokens,
    allowedHosts,
    // Origin pinning is opt-in (server-to-server clients omit Origin); set
    // MCP_ALLOWED_ORIGINS to lock it down to specific browser origins.
    allowedOrigins: splitList(env.MCP_ALLOWED_ORIGINS),
    resourceMetadataUrl: safeResourceMetadataUrl(publicUrl),
  };

  const metadata = buildProtectedResourceMetadata({
    publicUrl,
    scopes: ['kip:design'],
    authorizationServers: splitList(env.MCP_AUTHORIZATION_SERVERS),
  });

  const metadataPath = resourceMetadataPathFor(publicUrl);

  return { listenHost, port, mcpPath, publicUrl, metadataPath, security, metadata };
}

function safeResourceMetadataUrl(publicUrl: string): string {
  try {
    return resourceMetadataUrlFor(publicUrl);
  } catch {
    return '';
  }
}
