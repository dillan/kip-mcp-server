/**
 * HTTP session manager for the Streamable HTTP transport.
 *
 * The SDK's Protocol.connect() throws if a transport is already bound to it
 * ("use a separate Protocol instance per connection"), so each MCP session gets
 * its OWN server instance. This manager owns the Map<sessionId, {transport, server}>:
 * it creates a transport + server on the initialize request, reuses the transport
 * for follow-up requests carrying a matching mcp-session-id, and tears both down on
 * a DELETE (onsessionclosed) or at shutdown (closeAll). The per-session servers can
 * share one set of Signal K clients — there is no per-session upstream state to
 * isolate in a single-operator deployment.
 *
 * The real SDK transport is created through a small `createTransport` seam so unit
 * tests can inject a fake transport without opening a socket; production uses the
 * default factory that builds a StreamableHTTPServerTransport.
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * The transport the manager drives: a full MCP Transport (so it can be handed to
 * KipMCPServer.connect) that also exposes the Streamable HTTP `handleRequest`
 * method. The SDK's StreamableHTTPServerTransport satisfies this.
 */
export type TransportLike = Transport & {
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
};

/** Options the manager passes to its transport factory (mirrors the SDK options). */
export interface TransportOptions {
  sessionIdGenerator: () => string;
  onsessioninitialized?: (sessionId: string) => void;
  onsessionclosed?: (sessionId: string) => void;
  enableJsonResponse?: boolean;
  allowedHosts?: string[];
  allowedOrigins?: string[];
}

/** A per-session MCP server the manager connects and later disposes. */
export interface SessionServer {
  connect(transport: TransportLike): Promise<void>;
  dispose(): Promise<void> | void;
}

export interface HttpSessionManagerOptions {
  /** Builds a fresh server for a new session (one Protocol per connection). */
  createServer: () => SessionServer;
  /** Transport factory; defaults to the real SDK StreamableHTTPServerTransport. */
  createTransport?: (options: TransportOptions) => TransportLike;
  /** Session-id source. Defaults to a cryptographically random UUID. */
  generateSessionId?: () => string;
  /**
   * Optional belt-and-suspenders allowlists forwarded to the transport. NOT the
   * load-bearing control (those SDK fields are deprecated) — Origin/Host are
   * enforced in our own security chain before dispatch.
   */
  allowedHosts?: string[];
  allowedOrigins?: string[];
  /**
   * Return plain JSON responses instead of opening an SSE stream for each
   * request/response. Simpler for clients and sufficient here.
   */
  enableJsonResponse?: boolean;
}

interface SessionEntry {
  transport: TransportLike;
  server: SessionServer;
}

function defaultCreateTransport(options: TransportOptions): TransportLike {
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: options.sessionIdGenerator,
    onsessioninitialized: options.onsessioninitialized,
    onsessionclosed: options.onsessionclosed,
    ...(options.enableJsonResponse ? { enableJsonResponse: true } : {}),
    ...(options.allowedHosts ? { allowedHosts: options.allowedHosts } : {}),
    ...(options.allowedOrigins ? { allowedOrigins: options.allowedOrigins } : {}),
  });
}

export class HttpSessionManager {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly createTransport: (options: TransportOptions) => TransportLike;

  constructor(private readonly opts: HttpSessionManagerOptions) {
    this.createTransport = opts.createTransport ?? defaultCreateTransport;
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Route a request to its session's transport, creating a new session (and
   * server) when an initialize request arrives without a known session id.
   */
  async dispatch(req: IncomingMessage, res: ServerResponse, parsedBody: unknown): Promise<void> {
    const sessionId = headerValue(req.headers['mcp-session-id']);
    const existing = sessionId ? this.sessions.get(sessionId) : undefined;

    if (existing) {
      await existing.transport.handleRequest(req, res, parsedBody);
      return;
    }

    if (req.method === 'POST' && isInitializeRequest(parsedBody)) {
      const server = this.opts.createServer();
      const generate = this.opts.generateSessionId ?? (() => randomUUID());
      const transport = this.createTransport({
        sessionIdGenerator: generate,
        onsessioninitialized: (sid: string) => {
          this.sessions.set(sid, { transport, server });
        },
        onsessionclosed: (sid: string) => {
          void this.endSession(sid);
        },
        enableJsonResponse: this.opts.enableJsonResponse,
        allowedHosts: this.opts.allowedHosts,
        allowedOrigins: this.opts.allowedOrigins,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
      return;
    }

    // No usable session and not an initialize request.
    writeJsonRpcError(res, 400, 'Bad Request: no valid session ID or not an initialize request');
  }

  /** Remove a session and dispose its server (called on DELETE / onsessionclosed). */
  private async endSession(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return;
    }
    this.sessions.delete(sessionId);
    await entry.server.dispose();
  }

  /** Close every transport and dispose every server (graceful shutdown). */
  async closeAll(): Promise<void> {
    const entries = [...this.sessions.values()];
    this.sessions.clear();
    for (const { transport, server } of entries) {
      await transport.close();
      await server.dispose();
    }
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function writeJsonRpcError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message },
      id: null,
    }),
  );
}
