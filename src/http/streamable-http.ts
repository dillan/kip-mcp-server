import type { IncomingMessage, ServerResponse } from 'node:http';

/** The subset of the SDK transport the manager relies on. */
export interface TransportLike {
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
  close(): Promise<void>;
}

/** Options the manager passes to its transport factory (mirrors the SDK options). */
export interface TransportOptions {
  sessionIdGenerator: () => string;
  onsessioninitialized?: (sessionId: string) => void;
  onsessionclosed?: (sessionId: string) => void;
  enableJsonResponse?: boolean;
  allowedHosts?: string[];
  allowedOrigins?: string[];
}

export interface SessionServer {
  connect(transport: TransportLike): Promise<void>;
  dispose(): Promise<void> | void;
}

export interface HttpSessionManagerOptions {
  createServer: () => SessionServer;
  createTransport?: (options: TransportOptions) => TransportLike;
  generateSessionId?: () => string;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  enableJsonResponse?: boolean;
}

// RED stub — not implemented yet.
export class HttpSessionManager {
  constructor(_opts: HttpSessionManagerOptions) {}

  get sessionCount(): number {
    return -1;
  }

  async dispatch(_req: IncomingMessage, _res: ServerResponse, _parsedBody: unknown): Promise<void> {
    // intentionally does nothing
  }

  async closeAll(): Promise<void> {
    // intentionally does nothing
  }
}
