/**
 * Security chain for the remote HTTP transport.
 *
 * The remote endpoint exposes a boat's live data and KIP write tools to the
 * internet, so every request is checked here before it reaches the MCP transport:
 *   1. Host header allowlist  — our own durable DNS-rebinding control (the SDK
 *      transport's built-in allowedHosts/allowedOrigins fields are deprecated).
 *   2. Origin header allowlist — blocks cross-site (CSRF) calls from a browser.
 *   3. Static bearer token     — constant-time compared; a 401 carries a
 *      WWW-Authenticate challenge pointing at the resource metadata.
 *
 * The audit helper records the tool name and the argument KEYS only — never the
 * argument values, which can carry vessel position or other PII.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

export interface SecurityConfig {
  /** Accepted static bearer tokens. Empty disables bearer auth (must be paired with MCP_ALLOW_INSECURE). */
  bearerTokens: string[];
  /** Accepted Host header values (hostname or host:port). Empty disables host validation. */
  allowedHosts: string[];
  /** Accepted Origin header values. Empty disables origin validation. */
  allowedOrigins: string[];
  /** Absolute URL of the protected-resource metadata, advertised in 401 responses. */
  resourceMetadataUrl: string;
}

export type SecurityDecision =
  | { allowed: true; tokenId: string }
  | { allowed: false; status: number; headers: Record<string, string>; message: string };

/**
 * Compare two strings without leaking length or content through timing. Both
 * sides are hashed to a fixed-width digest first, so even differing lengths take
 * the same time and never throw.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a, 'utf8').digest();
  const bh = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ah, bh);
}

/** A short, non-reversible id for a token, safe to write to the audit log. */
export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 8);
}

export function checkSecurity(
  headers: IncomingHttpHeaders,
  config: SecurityConfig,
): SecurityDecision {
  // 1. Host allowlist (DNS-rebinding protection). Host names are case-insensitive,
  //    so compare lowercased.
  if (config.allowedHosts.length > 0) {
    const host = headerValue(headers.host);
    if (!host || !includesIgnoreCase(config.allowedHosts, host)) {
      return forbidden('Forbidden: host not allowed');
    }
  }

  // 2. Origin allowlist (only when the client sent an Origin — non-browser
  //    clients omit it and cannot mount a DNS-rebinding/CSRF attack). An origin
  //    is scheme://host[:port] with no path, so a case-insensitive compare is safe.
  const origin = headerValue(headers.origin);
  if (origin && config.allowedOrigins.length > 0) {
    if (!includesIgnoreCase(config.allowedOrigins, origin)) {
      return forbidden('Forbidden: origin not allowed');
    }
  }

  // 3. Static bearer token.
  if (config.bearerTokens.length > 0) {
    const provided = parseBearer(headerValue(headers.authorization));
    const matched = provided
      ? config.bearerTokens.find((t) => constantTimeEqual(t, provided))
      : undefined;
    if (!matched) {
      const challenge = `Bearer resource_metadata="${config.resourceMetadataUrl}"${
        provided ? ', error="invalid_token"' : ''
      }`;
      return {
        allowed: false,
        status: 401,
        headers: { 'WWW-Authenticate': challenge },
        message: 'Unauthorized',
      };
    }
    return { allowed: true, tokenId: tokenFingerprint(matched) };
  }

  return { allowed: true, tokenId: 'none' };
}

export interface AuditInput {
  timestamp: string;
  /** HTTP method + path, so unauthenticated probes (401/403/404) are visible. */
  httpMethod: string | null;
  path: string | null;
  tokenId: string | null;
  sessionId: string | null;
  method: string | null;
  tool: string | null;
  /** Argument KEYS only — never values. */
  argKeys: string[];
  status: number;
  latencyMs: number;
}

export function formatAuditLine(input: AuditInput): string {
  return JSON.stringify({
    ts: input.timestamp,
    httpMethod: input.httpMethod,
    path: input.path,
    tokenId: input.tokenId,
    sessionId: input.sessionId,
    method: input.method,
    tool: input.tool,
    argKeys: input.argKeys,
    status: input.status,
    latencyMs: input.latencyMs,
  });
}

/**
 * Pull the loggable shape out of a JSON-RPC request body: the method, the called
 * tool, and the argument KEYS (never the values).
 */
export function summarizeRpc(body: unknown): {
  method: string | null;
  tool: string | null;
  argKeys: string[];
} {
  if (!body || typeof body !== 'object') {
    return { method: null, tool: null, argKeys: [] };
  }
  const b = body as {
    method?: unknown;
    params?: { name?: unknown; arguments?: unknown };
  };
  const method = typeof b.method === 'string' ? b.method : null;
  let tool: string | null = null;
  let argKeys: string[] = [];
  if (method === 'tools/call' && b.params && typeof b.params === 'object') {
    tool = typeof b.params.name === 'string' ? b.params.name : null;
    const args = b.params.arguments;
    // Plain object only — arrays would log numeric indices, not real keys.
    if (args && typeof args === 'object' && !Array.isArray(args)) {
      argKeys = Object.keys(args as Record<string, unknown>);
    }
  }
  return { method, tool, argKeys };
}

function forbidden(message: string): SecurityDecision {
  return { allowed: false, status: 403, headers: {}, message };
}

function parseBearer(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  const token = match ? match[1].trim() : undefined;
  // A header of "Bearer   " parses to an empty token; treat it as absent so it
  // can never coincide with a stray empty entry in the token list.
  return token ? token : undefined;
}

function includesIgnoreCase(list: string[], value: string): boolean {
  const lowered = value.toLowerCase();
  return list.some((entry) => entry.toLowerCase() === lowered);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
