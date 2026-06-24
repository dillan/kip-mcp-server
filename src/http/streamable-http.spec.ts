/**
 * HTTP session-manager unit tests (RED first; fail on purpose until
 * streamable-http.ts is implemented).
 *
 * Verified against the SDK: Protocol.connect() throws if a transport is already
 * bound ("use a separate Protocol instance per connection"), so each MCP session
 * gets its OWN server instance. The manager tracks Map<sessionId,{transport,server}>,
 * reuses the transport for a known mcp-session-id, and tears everything down on
 * DELETE / shutdown. A `createTransport` seam lets us inject a fake transport so
 * no socket is opened.
 */
import { jest } from '@jest/globals';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  HttpSessionManager,
  type SessionServer,
  type TransportLike,
  type TransportOptions,
} from './streamable-http.js';

interface FakeTransport extends TransportLike {
  options: TransportOptions;
  initialized: boolean;
  handleCount: number;
  closeCount: number;
}

const makeFakeTransportFactory = () => {
  const created: FakeTransport[] = [];
  const factory = (options: TransportOptions): TransportLike => {
    const transport: FakeTransport = {
      options,
      initialized: false,
      handleCount: 0,
      closeCount: 0,
      async handleRequest() {
        transport.handleCount += 1;
        if (!transport.initialized) {
          transport.initialized = true;
          const sid = options.sessionIdGenerator();
          options.onsessioninitialized?.(sid);
        }
      },
      async close() {
        transport.closeCount += 1;
      },
    };
    created.push(transport);
    return transport;
  };
  return { factory, created };
};

const makeFakeServer = () => {
  const server: SessionServer & { connectCount: number; disposeCount: number } = {
    connectCount: 0,
    disposeCount: 0,
    async connect() {
      server.connectCount += 1;
    },
    async dispose() {
      server.disposeCount += 1;
    },
  };
  return server;
};

const fakeRes = () =>
  ({
    writeHead: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    end: jest.fn(),
  }) as unknown as ServerResponse;

const req = (method: string, headers: Record<string, string> = {}): IncomingMessage =>
  ({ method, headers }) as unknown as IncomingMessage;

const initBody = { jsonrpc: '2.0', method: 'initialize', id: 1 };

describe('HttpSessionManager', () => {
  it('creates a transport and connects a fresh server on initialize', async () => {
    const servers: ReturnType<typeof makeFakeServer>[] = [];
    const { factory, created } = makeFakeTransportFactory();
    const manager = new HttpSessionManager({
      createServer: () => {
        const s = makeFakeServer();
        servers.push(s);
        return s;
      },
      createTransport: factory,
      generateSessionId: () => 'sess-1',
    });

    await manager.dispatch(req('POST'), fakeRes(), initBody);

    expect(created).toHaveLength(1);
    expect(servers).toHaveLength(1);
    expect(servers[0].connectCount).toBe(1);
    expect(created[0].handleCount).toBe(1);
    expect(manager.sessionCount).toBe(1);
  });

  it('reuses the same transport for a known session id (no new server)', async () => {
    const servers: ReturnType<typeof makeFakeServer>[] = [];
    const { factory, created } = makeFakeTransportFactory();
    const manager = new HttpSessionManager({
      createServer: () => {
        const s = makeFakeServer();
        servers.push(s);
        return s;
      },
      createTransport: factory,
      generateSessionId: () => 'sess-1',
    });
    await manager.dispatch(req('POST'), fakeRes(), initBody);

    await manager.dispatch(req('POST', { 'mcp-session-id': 'sess-1' }), fakeRes(), {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 2,
    });

    // No second transport or server was created.
    expect(created).toHaveLength(1);
    expect(servers).toHaveLength(1);
    // The one transport handled both the initialize and the follow-up.
    expect(created[0].handleCount).toBe(2);
    expect(manager.sessionCount).toBe(1);
  });

  it('rejects an unknown session id that is not an initialize request with 400', async () => {
    const { factory, created } = makeFakeTransportFactory();
    let built = 0;
    const manager = new HttpSessionManager({
      createServer: () => {
        built += 1;
        return makeFakeServer();
      },
      createTransport: factory,
    });
    const res = fakeRes();

    await manager.dispatch(req('POST', { 'mcp-session-id': 'does-not-exist' }), res, {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 9,
    });

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    expect(created).toHaveLength(0);
    expect(built).toBe(0);
    expect(manager.sessionCount).toBe(0);
  });

  it('onsessionclosed (DELETE) removes the session and disposes its server', async () => {
    const servers: ReturnType<typeof makeFakeServer>[] = [];
    const { factory, created } = makeFakeTransportFactory();
    const manager = new HttpSessionManager({
      createServer: () => {
        const s = makeFakeServer();
        servers.push(s);
        return s;
      },
      createTransport: factory,
      generateSessionId: () => 'sess-1',
    });
    await manager.dispatch(req('POST'), fakeRes(), initBody);

    // Simulate the SDK firing onsessionclosed on a DELETE.
    created[0].options.onsessionclosed?.('sess-1');
    await Promise.resolve();

    expect(manager.sessionCount).toBe(0);
    expect(servers[0].disposeCount).toBe(1);
  });

  it('closeAll closes every transport and disposes every server', async () => {
    const servers: ReturnType<typeof makeFakeServer>[] = [];
    const { factory, created } = makeFakeTransportFactory();
    const manager = new HttpSessionManager({
      createServer: () => {
        const s = makeFakeServer();
        servers.push(s);
        return s;
      },
      createTransport: factory,
      generateSessionId: () => 'sess-1',
    });
    await manager.dispatch(req('POST'), fakeRes(), initBody);

    await manager.closeAll();

    expect(created[0].closeCount).toBe(1);
    expect(servers[0].disposeCount).toBe(1);
    expect(manager.sessionCount).toBe(0);
  });

  it('passes enableJsonResponse and the allowlists to the transport options', async () => {
    const { factory, created } = makeFakeTransportFactory();
    const manager = new HttpSessionManager({
      createServer: makeFakeServer,
      createTransport: factory,
      generateSessionId: () => 'sess-1',
      enableJsonResponse: true,
      allowedHosts: ['boat.example.com'],
      allowedOrigins: ['https://claude.ai'],
    });
    await manager.dispatch(req('POST'), fakeRes(), initBody);

    expect(created[0].options.enableJsonResponse).toBe(true);
    expect(created[0].options.allowedHosts).toEqual(['boat.example.com']);
    expect(created[0].options.allowedOrigins).toEqual(['https://claude.ai']);
  });
});
