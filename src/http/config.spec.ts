/**
 * Unit tests for the remote HTTP config loader (RED first; fail on purpose until
 * config.ts is implemented).
 *
 * The refuse-to-start guard and the Host allowlist derivation are security
 * critical, so they are locked here at the unit level. process.exit is spied so
 * the refusal is observable without killing the test worker.
 */
import { jest } from '@jest/globals';
import { loadHttpConfig, splitList } from './config.js';

describe('splitList', () => {
  it('splits, trims, and drops empties', () => {
    expect(splitList('a, b ,, c')).toEqual(['a', 'b', 'c']);
    expect(splitList(undefined)).toEqual([]);
    expect(splitList('')).toEqual([]);
  });
});

describe('loadHttpConfig', () => {
  let exitSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    // Make process.exit observable without killing the test process.
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    jest.restoreAllMocks();
  });

  const safeEnv = (over: Record<string, string> = {}): NodeJS.ProcessEnv => ({
    HTTP_HOST: '127.0.0.1',
    MCP_BEARER_TOKEN: 'tok',
    MCP_PUBLIC_URL: 'https://boat.example.com/mcp',
    ...over,
  });

  it('returns a usable config for a safe (loopback + token) setup', () => {
    const cfg = loadHttpConfig(safeEnv());
    expect(cfg.listenHost).toBe('127.0.0.1');
    expect(cfg.port).toBe(3017);
    expect(cfg.mcpPath).toBe('/mcp');
    expect(cfg.publicUrl).toBe('https://boat.example.com/mcp');
    expect(cfg.security.bearerTokens).toEqual(['tok']);
    expect(cfg.metadata.resource).toBe('https://boat.example.com/mcp');
    expect(cfg.metadata.scopes_supported).toEqual(['kip:design']);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('honours HTTP_PORT and HTTP_PATH overrides', () => {
    const cfg = loadHttpConfig(safeEnv({ HTTP_PORT: '8080', HTTP_PATH: '/kip-mcp' }));
    expect(cfg.port).toBe(8080);
    expect(cfg.mcpPath).toBe('/kip-mcp');
  });

  it('rejects an out-of-range HTTP_PORT', () => {
    expect(() => loadHttpConfig(safeEnv({ HTTP_PORT: '70000' }))).toThrow(/HTTP_PORT/);
    expect(() => loadHttpConfig(safeEnv({ HTTP_PORT: 'abc' }))).toThrow(/HTTP_PORT/);
  });

  it('refuses to start when bound to a non-loopback address without an override', () => {
    expect(() => loadHttpConfig(safeEnv({ HTTP_HOST: '0.0.0.0' }))).toThrow(/process\.exit:1/);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('refuses to start when no bearer token is configured', () => {
    const env = safeEnv();
    delete (env as Record<string, unknown>).MCP_BEARER_TOKEN;
    expect(() => loadHttpConfig(env)).toThrow(/process\.exit:1/);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('MCP_ALLOW_INSECURE=true overrides the refusal (with a warning)', () => {
    const cfg = loadHttpConfig(safeEnv({ HTTP_HOST: '0.0.0.0', MCP_ALLOW_INSECURE: 'true' }));
    expect(cfg.listenHost).toBe('0.0.0.0');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('derives the Host allowlist from the public URL plus loopback forms', () => {
    const cfg = loadHttpConfig(safeEnv({ HTTP_PORT: '3017' }));
    expect(cfg.security.allowedHosts).toContain('boat.example.com');
    expect(cfg.security.allowedHosts).toContain('127.0.0.1');
    expect(cfg.security.allowedHosts).toContain('127.0.0.1:3017');
    expect(cfg.security.allowedHosts).toContain('localhost');
  });

  it('when the public URL has a port, both host:port and the bare hostname are allowed', () => {
    const cfg = loadHttpConfig(safeEnv({ MCP_PUBLIC_URL: 'https://boat.example.com:8443/mcp' }));
    expect(cfg.security.allowedHosts).toContain('boat.example.com:8443');
    expect(cfg.security.allowedHosts).toContain('boat.example.com');
  });

  it('defaults the public URL from host/port/path when MCP_PUBLIC_URL is unset', () => {
    const env = safeEnv();
    delete (env as Record<string, unknown>).MCP_PUBLIC_URL;
    const cfg = loadHttpConfig(env);
    expect(cfg.publicUrl).toBe('http://127.0.0.1:3017/mcp');
  });

  it('an explicit MCP_ALLOWED_HOSTS replaces the derived list', () => {
    const cfg = loadHttpConfig(safeEnv({ MCP_ALLOWED_HOSTS: 'a.example.com, b.example.com' }));
    expect(cfg.security.allowedHosts).toEqual(['a.example.com', 'b.example.com']);
  });

  it('origin pinning is off unless MCP_ALLOWED_ORIGINS is set', () => {
    expect(loadHttpConfig(safeEnv()).security.allowedOrigins).toEqual([]);
    expect(
      loadHttpConfig(safeEnv({ MCP_ALLOWED_ORIGINS: 'https://claude.ai' })).security.allowedOrigins,
    ).toEqual(['https://claude.ai']);
  });

  it('advertises the resource-metadata URL derived from the public URL', () => {
    const cfg = loadHttpConfig(safeEnv());
    expect(cfg.security.resourceMetadataUrl).toBe(
      'https://boat.example.com/.well-known/oauth-protected-resource/mcp',
    );
  });

  it('serves the metadata at the path component of the advertised URL', () => {
    expect(loadHttpConfig(safeEnv()).metadataPath).toBe(
      '/.well-known/oauth-protected-resource/mcp',
    );
    // A custom endpoint path must still be reachable at the advertised path.
    const custom = loadHttpConfig(safeEnv({ MCP_PUBLIC_URL: 'https://boat.example.com/kip-mcp' }));
    expect(custom.metadataPath).toBe('/.well-known/oauth-protected-resource/kip-mcp');
    expect(new URL(custom.security.resourceMetadataUrl).pathname).toBe(custom.metadataPath);
  });

  it('treats LOCALHOST (any case) as loopback and starts without an override', () => {
    const cfg = loadHttpConfig(safeEnv({ HTTP_HOST: 'LOCALHOST' }));
    expect(cfg.listenHost).toBe('LOCALHOST');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('treats the IPv6 loopback ::1 as loopback and allows its bracketed Host forms', () => {
    const env = safeEnv({ HTTP_HOST: '::1' });
    // Use the derived public URL so the bracketed forms are exercised.
    delete (env as Record<string, unknown>).MCP_PUBLIC_URL;
    const cfg = loadHttpConfig(env);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(cfg.publicUrl).toBe('http://[::1]:3017/mcp');
    expect(cfg.security.allowedHosts).toContain('[::1]');
    expect(cfg.security.allowedHosts).toContain('[::1]:3017');
  });
});
