import type { SecurityConfig } from './security.js';
import type { ProtectedResourceMetadata } from './resource-metadata.js';

export interface HttpServerConfig {
  listenHost: string;
  port: number;
  mcpPath: string;
  publicUrl: string;
  security: SecurityConfig;
  metadata: ProtectedResourceMetadata;
}

// RED stub — not implemented yet.
export function splitList(_value: string | undefined): string[] {
  return [];
}

export function loadHttpConfig(_env: NodeJS.ProcessEnv = process.env): HttpServerConfig {
  return {
    listenHost: '',
    port: 0,
    mcpPath: '',
    publicUrl: '',
    security: { bearerTokens: [], allowedHosts: [], allowedOrigins: [], resourceMetadataUrl: '' },
    metadata: { resource: '', scopes_supported: [], bearer_methods_supported: [] },
  };
}
