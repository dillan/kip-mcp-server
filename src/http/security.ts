import type { IncomingHttpHeaders } from 'node:http';

export interface SecurityConfig {
  bearerTokens: string[];
  allowedHosts: string[];
  allowedOrigins: string[];
  resourceMetadataUrl: string;
}

export type SecurityDecision =
  | { allowed: true; tokenId: string }
  | { allowed: false; status: number; headers: Record<string, string>; message: string };

// RED stub — not implemented yet.
export function constantTimeEqual(_a: string, _b: string): boolean {
  return false;
}

export function tokenFingerprint(_token: string): string {
  return '';
}

export function checkSecurity(
  _headers: IncomingHttpHeaders,
  _config: SecurityConfig,
): SecurityDecision {
  return { allowed: false, status: 500, headers: {}, message: 'not implemented' };
}

export interface AuditInput {
  timestamp: string;
  httpMethod: string | null;
  path: string | null;
  tokenId: string | null;
  sessionId: string | null;
  method: string | null;
  tool: string | null;
  argKeys: string[];
  status: number;
  latencyMs: number;
}

export function formatAuditLine(_input: AuditInput): string {
  return '{}';
}

export function summarizeRpc(_body: unknown): {
  method: string | null;
  tool: string | null;
  argKeys: string[];
} {
  return { method: null, tool: null, argKeys: [] };
}
