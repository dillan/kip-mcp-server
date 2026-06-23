/** Server configuration derived from environment variables. */
export interface ServerConfig {
  /** KIP webapp base URL, used to fetch the live schema. */
  kipBaseUrl: string;
}

/**
 * Builds the config from the environment. `KIP_URL` overrides; otherwise the KIP
 * base is derived from the Signal K host/port (KIP is served at /@mxtommy/kip/).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const override = env.KIP_URL?.trim();
  if (override) {
    return { kipBaseUrl: ensureTrailingSlash(override) };
  }
  const host = env.SIGNALK_HOST?.trim() || 'localhost';
  const port = env.SIGNALK_PORT?.trim() || '3000';
  const protocol = env.SIGNALK_TLS === 'true' ? 'https' : 'http';
  return { kipBaseUrl: `${protocol}://${host}:${port}/@mxtommy/kip/` };
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
