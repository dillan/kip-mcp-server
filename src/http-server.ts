#!/usr/bin/env node
/**
 * Optional remote HTTP entrypoint for the KIP MCP server (opt-in).
 *
 * This is a SEPARATE process from the stdio entrypoint (src/index.ts). It serves
 * the Streamable HTTP transport so a hosted assistant (Claude.ai, ChatGPT) can
 * design and install KIP dashboards over the internet, behind an operator-provided
 * reverse proxy that terminates TLS. The node listener binds to loopback by default
 * and refuses to start in an unsafe topology (non-loopback bind or no auth) unless
 * MCP_ALLOW_INSECURE is set.
 *
 * It is a single-operator deployment: every session shares one Signal K identity
 * (one TokenProvider / SkClient / SkAppDataClient), gated by a single static bearer
 * token. This file is the thin wiring only — the safety-critical and reusable logic
 * lives in the unit-tested src/http/* modules, so this entrypoint is excluded from
 * coverage exactly like src/index.ts.
 */
import * as http from 'node:http';
import * as dotenv from 'dotenv';
import { loadConfig } from './config.js';
import { SkClient } from './discovery/sk-client.js';
import { KipMCPServer } from './kip-mcp-server.js';
import { TokenProvider } from './signalk/auth.js';
import { SkAppDataClient } from './write/appdata-client.js';
import { loadHttpConfig, type HttpServerConfig } from './http/config.js';
import { checkSecurity, formatAuditLine, summarizeRpc } from './http/security.js';
import { HttpSessionManager } from './http/streamable-http.js';

// quiet: keep dotenv's startup tip out of stdout (matches the stdio entrypoint).
dotenv.config({ quiet: true });

export { loadHttpConfig, type HttpServerConfig };

export interface RunningHttpServer {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
}

// JSON-RPC requests are tiny; cap the body so a malicious client cannot exhaust
// memory by streaming an unbounded payload.
const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        // Stop buffering (memory stays bounded) and reject; the caller responds
        // 413. We do not destroy the socket here so the response can be sent.
        settled = true;
        reject(new HttpError(413, 'Payload Too Large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    });
    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

export async function startHttpServer(config: HttpServerConfig): Promise<RunningHttpServer> {
  // Reuse the same env-driven Signal K / KIP config the stdio server uses.
  const base = loadConfig();
  // One token source, shared by every per-session server (mirrors the single
  // TokenProvider in KipMCPServer): a username/password login runs once per token
  // lifetime and is re-authenticated on demand when a request is rejected (401/403).
  const tokens = new TokenProvider({
    baseUrl: base.signalkBaseUrl,
    token: base.token,
    credentials: base.credentials,
  });
  const getToken = (opts?: { forceRefresh?: boolean }) => tokens.get(opts);
  const sk = new SkClient({ baseUrl: base.signalkBaseUrl, getToken });
  const appData = new SkAppDataClient({ baseUrl: base.signalkBaseUrl, getToken });

  const manager = new HttpSessionManager({
    createServer: () => {
      // The SDK requires a fresh Protocol per connection, so each session gets its
      // own KipMCPServer; the read/write clients above are shared and stateless.
      const instance = new KipMCPServer({ sk, appData });
      return {
        connect: (transport) => instance.connect(transport),
        dispose: () => {
          /* the per-session server owns no resources; shared clients live on */
        },
      };
    },
    allowedHosts: config.security.allowedHosts,
    allowedOrigins: config.security.allowedOrigins,
    enableJsonResponse: true,
  });

  const server = http.createServer((req, res) => {
    // A socket error must not become an unhandled 'error' event on the listener.
    res.on('error', () => {});
    handleRequest(req, res, config, manager).catch((err) => {
      console.error('[kip-mcp-http] request handler error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal error' }));
      } else {
        res.end();
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(config.port, config.listenHost, resolve);
  });
  const addr = server.address();
  const boundPort = typeof addr === 'object' && addr ? addr.port : config.port;

  console.error(
    `[kip-mcp-http] MCP listening on http://${config.listenHost}:${boundPort}${config.mcpPath} ` +
      `(public: ${config.publicUrl})`,
  );

  const close = async (): Promise<void> => {
    await manager.closeAll();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  };

  return { server, port: boundPort, close };
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: HttpServerConfig,
  manager: HttpSessionManager,
): Promise<void> {
  const started = Date.now();
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  // Mutable audit context, filled in as the request proceeds. The finish listener
  // is attached up front so EVERY response is logged — including health checks,
  // 404 path probes, and 401/403 auth failures (so brute-force is visible).
  const audit = {
    tokenId: null as string | null,
    method: null as string | null,
    tool: null as string | null,
    argKeys: [] as string[],
  };
  res.on('finish', () => {
    console.error(
      formatAuditLine({
        timestamp: new Date().toISOString(),
        httpMethod: req.method ?? null,
        path: url.pathname,
        tokenId: audit.tokenId,
        sessionId: (req.headers['mcp-session-id'] as string | undefined) ?? null,
        method: audit.method,
        tool: audit.tool,
        argKeys: audit.argKeys,
        status: res.statusCode,
        latencyMs: Date.now() - started,
      }),
    );
  });

  // Health check — no auth, no data.
  if (req.method === 'GET' && url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Protected resource metadata — public, so a 401 is discoverable. Served at the
  // exact path advertised in the 401 challenge (derived from the endpoint path).
  if (req.method === 'GET' && url.pathname === config.metadataPath) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config.metadata));
    return;
  }

  if (url.pathname !== config.mcpPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  // Security chain: Host/Origin/bearer, before the transport sees anything.
  const decision = checkSecurity(req.headers, config.security);
  if (!decision.allowed) {
    res.writeHead(decision.status, {
      'Content-Type': 'application/json',
      ...decision.headers,
    });
    res.end(JSON.stringify({ error: decision.message }));
    return;
  }
  audit.tokenId = decision.tokenId;

  let parsedBody: unknown;
  if (req.method === 'POST') {
    // Reject an oversized body up front from its declared length, draining the
    // socket so the client receives the 413 cleanly instead of a reset.
    const declared = Number.parseInt(
      (Array.isArray(req.headers['content-length'])
        ? req.headers['content-length'][0]
        : req.headers['content-length']) ?? '',
      10,
    );
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      req.resume();
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'payload too large' }));
      return;
    }
    let raw: string;
    try {
      raw = await readBody(req);
    } catch (err) {
      const status = err instanceof HttpError ? err.statusCode : 400;
      if (status === 413) req.resume(); // drain the remainder for a clean response
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'could not read request body' }));
      return;
    }
    if (raw.length > 0) {
      try {
        parsedBody = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid JSON body' }));
        return;
      }
    }
  }

  // Record the tool name + arg KEYS (never values) for the audit line.
  const summary = summarizeRpc(parsedBody);
  audit.method = summary.method;
  audit.tool = summary.tool;
  audit.argKeys = summary.argKeys;

  await manager.dispatch(req, res, parsedBody);
}

// Run when invoked as the bin (not when imported by a test). The build is flat
// (rootDir:src), so the compiled file is dist/http-server.js.
const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('http-server.js') || process.argv[1].endsWith('http-server.ts'));

if (invokedDirectly) {
  void (async () => {
    const config = loadHttpConfig();
    const running = await startHttpServer(config);

    const shutdown = (signal: string) => {
      console.error(`[kip-mcp-http] ${signal} received, shutting down`);
      running
        .close()
        .then(() => process.exit(0))
        .catch((err) => {
          console.error('[kip-mcp-http] error during shutdown:', err);
          process.exit(1);
        });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })();
}
