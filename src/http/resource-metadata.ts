export const RESOURCE_METADATA_PATH = '';

export interface ResourceMetadataConfig {
  publicUrl: string;
  authorizationServers?: string[];
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

// RED stub — not implemented yet.
export function buildProtectedResourceMetadata(
  _config: ResourceMetadataConfig,
): ProtectedResourceMetadata {
  return { resource: '', scopes_supported: [], bearer_methods_supported: [] };
}

export function resourceMetadataUrlFor(_publicUrl: string): string {
  return '';
}
