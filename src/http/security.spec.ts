/**
 * Security-chain unit tests (RED first; these fail on purpose until security.ts
 * is implemented).
 *
 * The remote HTTP endpoint puts a boat's live data and write tools on the
 * internet, so every request must pass Host + Origin validation (our own durable
 * control — the SDK transport's built-in fields are deprecated) and a
 * constant-time static bearer check before it ever reaches the MCP transport. The
 * audit log must record the tool name and the argument KEYS, never the argument
 * values (which can carry vessel position / PII).
 */
import {
  checkSecurity,
  constantTimeEqual,
  tokenFingerprint,
  formatAuditLine,
  summarizeRpc,
  type SecurityConfig,
} from './security.js';

const baseConfig: SecurityConfig = {
  bearerTokens: ['s3cret-token'],
  allowedHosts: ['boat.example.com', '127.0.0.1:3017'],
  allowedOrigins: ['https://claude.ai', 'https://chatgpt.com'],
  resourceMetadataUrl: 'https://boat.example.com/.well-known/oauth-protected-resource/mcp',
};

const okHeaders = () => ({
  host: 'boat.example.com',
  origin: 'https://claude.ai',
  authorization: 'Bearer s3cret-token',
});

describe('constantTimeEqual', () => {
  it('is true only for identical strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    // A length mismatch must not throw and must be false.
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });
});

describe('tokenFingerprint', () => {
  it('is stable, short, and not the token itself', () => {
    const fp = tokenFingerprint('s3cret-token');
    expect(fp).toBe(tokenFingerprint('s3cret-token'));
    expect(fp).not.toContain('s3cret-token');
    expect(fp.length).toBeLessThanOrEqual(16);
    expect(tokenFingerprint('other')).not.toBe(fp);
  });
});

describe('checkSecurity', () => {
  it('allows a well-formed, authorized request and reports a tokenId', () => {
    const decision = checkSecurity(okHeaders(), baseConfig);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.tokenId).toBe(tokenFingerprint('s3cret-token'));
    }
  });

  it('rejects a disallowed Host with 403 (before auth)', () => {
    const decision = checkSecurity({ ...okHeaders(), host: 'evil.attacker.test' }, baseConfig);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.status).toBe(403);
    }
  });

  it('rejects a disallowed Origin with 403 even when the bearer is valid', () => {
    const decision = checkSecurity(
      { ...okHeaders(), origin: 'https://evil.attacker.test' },
      baseConfig,
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.status).toBe(403);
    }
  });

  it('allows a request with no Origin header (non-browser client)', () => {
    const headers = okHeaders();
    delete (headers as Record<string, unknown>).origin;
    const decision = checkSecurity(headers, baseConfig);
    expect(decision.allowed).toBe(true);
  });

  it('rejects a missing bearer with 401 + WWW-Authenticate pointing at resource metadata', () => {
    const headers = okHeaders();
    delete (headers as Record<string, unknown>).authorization;
    const decision = checkSecurity(headers, baseConfig);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.status).toBe(401);
      expect(decision.headers['WWW-Authenticate']).toContain('Bearer');
      expect(decision.headers['WWW-Authenticate']).toContain(baseConfig.resourceMetadataUrl);
    }
  });

  it('marks a wrong bearer as invalid_token in the challenge and returns 401', () => {
    const decision = checkSecurity(
      { ...okHeaders(), authorization: 'Bearer not-the-token' },
      baseConfig,
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.status).toBe(401);
      expect(decision.headers['WWW-Authenticate']).toContain('invalid_token');
    }
  });

  it('accepts any of several comma-rotated tokens', () => {
    const cfg = { ...baseConfig, bearerTokens: ['old-token', 'new-token'] };
    const decision = checkSecurity({ ...okHeaders(), authorization: 'Bearer new-token' }, cfg);
    expect(decision.allowed).toBe(true);
  });

  it('skips bearer enforcement when no tokens are configured (insecure mode)', () => {
    const cfg = { ...baseConfig, bearerTokens: [] };
    const headers = okHeaders();
    delete (headers as Record<string, unknown>).authorization;
    const decision = checkSecurity(headers, cfg);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.tokenId).toBe('none');
    }
  });

  it('skips host validation when no hosts are configured', () => {
    const cfg = { ...baseConfig, allowedHosts: [] };
    const decision = checkSecurity({ ...okHeaders(), host: 'anything.test' }, cfg);
    expect(decision.allowed).toBe(true);
  });

  it('accepts a Host that differs only in letter case', () => {
    const decision = checkSecurity({ ...okHeaders(), host: 'BOAT.Example.com' }, baseConfig);
    expect(decision.allowed).toBe(true);
  });

  it('accepts an Origin that differs only in letter case', () => {
    const decision = checkSecurity({ ...okHeaders(), origin: 'HTTPS://Claude.ai' }, baseConfig);
    expect(decision.allowed).toBe(true);
  });

  it('treats a blank "Bearer   " header as no token', () => {
    const headers = okHeaders();
    delete (headers as Record<string, unknown>).authorization;
    const decision = checkSecurity({ ...headers, authorization: 'Bearer    ' }, baseConfig);
    expect(decision.allowed).toBe(false);
  });
});

describe('formatAuditLine', () => {
  it('records the tool name and arg KEYS but never arg values', () => {
    const line = formatAuditLine({
      timestamp: '2026-06-23T00:00:00.000Z',
      httpMethod: 'POST',
      path: '/mcp',
      tokenId: 'abc12345',
      sessionId: 'sess-1',
      method: 'tools/call',
      tool: 'apply_kip_plan',
      argKeys: ['scope', 'dashboards'],
      status: 200,
      latencyMs: 12,
    });
    const parsed = JSON.parse(line);
    expect(parsed.tool).toBe('apply_kip_plan');
    expect(parsed.argKeys).toEqual(['scope', 'dashboards']);
    expect(parsed.path).toBe('/mcp');
    // The VALUE of an argument (e.g. a vessel position) must never appear.
    expect(line).not.toContain('navigation.position');
    expect(line).not.toContain('59.91');
  });
});

describe('summarizeRpc', () => {
  it('lists argument keys for a tools/call, never values', () => {
    const s = summarizeRpc({
      method: 'tools/call',
      params: { name: 'apply_kip_plan', arguments: { scope: 'self', dashboards: 'x' } },
    });
    expect(s.method).toBe('tools/call');
    expect(s.tool).toBe('apply_kip_plan');
    expect(s.argKeys).toEqual(['scope', 'dashboards']);
  });

  it('does not treat array arguments as keyed (no numeric indices logged)', () => {
    const s = summarizeRpc({
      method: 'tools/call',
      params: { name: 'x', arguments: ['a', 'b'] },
    });
    expect(s.argKeys).toEqual([]);
  });

  it('returns empty fields for a non-object or non-tools/call body', () => {
    expect(summarizeRpc(null)).toEqual({ method: null, tool: null, argKeys: [] });
    expect(summarizeRpc({ method: 'tools/list' })).toEqual({
      method: 'tools/list',
      tool: null,
      argKeys: [],
    });
  });
});
