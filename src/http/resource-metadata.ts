/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * Serving this small document at /.well-known/oauth-protected-resource/mcp makes a
 * 401 from the MCP endpoint discoverable by compliant clients (Claude.ai, ChatGPT):
 * they read it to learn the resource identifier, the supported scopes, and — once a
 * later phase lands — which authorization server to use. In the static-bearer phase
 * we advertise the resource and the least-privilege `kip:design` scope, and omit
 * authorization_servers because there is no external AS yet.
 */
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';

export const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource/mcp';

export interface ResourceMetadataConfig {
  /** Canonical public URL of the MCP endpoint, e.g. https://boat.example.com/mcp */
  publicUrl: string;
  /** External authorization servers, if any (later phase). Omitted when empty. */
  authorizationServers?: string[];
  /** Scopes this resource understands. Defaults to least-privilege design access. */
  scopes?: string[];
  resourceName?: string;
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers?: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_name?: string;
}

export function buildProtectedResourceMetadata(
  config: ResourceMetadataConfig,
): ProtectedResourceMetadata {
  const meta: ProtectedResourceMetadata = {
    resource: config.publicUrl,
    scopes_supported: config.scopes ?? ['kip:design'],
    bearer_methods_supported: ['header'],
  };
  if (config.authorizationServers && config.authorizationServers.length > 0) {
    meta.authorization_servers = config.authorizationServers;
  }
  if (config.resourceName) {
    meta.resource_name = config.resourceName;
  }
  return meta;
}

/**
 * The well-known URL where the metadata is served, derived from the server URL by
 * the SDK helper so it matches the spec exactly.
 */
export function resourceMetadataUrlFor(publicUrl: string): string {
  return getOAuthProtectedResourceMetadataUrl(new URL(publicUrl));
}

/**
 * The local path the listener must serve the metadata at, derived from the same
 * SDK helper. This depends on the endpoint path (e.g. /mcp -> .../mcp), so the
 * document is always reachable at exactly the URL advertised in the 401 challenge
 * — even when HTTP_PATH is customised. Falls back to the default constant if the
 * URL cannot be parsed.
 */
export function resourceMetadataPathFor(publicUrl: string): string {
  try {
    return new URL(resourceMetadataUrlFor(publicUrl)).pathname;
  } catch {
    return RESOURCE_METADATA_PATH;
  }
}
