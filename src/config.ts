import type { Credentials } from './signalk/auth.js';

/** Server configuration derived from environment variables. */
export interface ServerConfig {
  /** Signal K server base URL, e.g. http://host:3000 */
  signalkBaseUrl: string;
  /** KIP webapp base URL, used to fetch the live schema. */
  kipBaseUrl: string;
  /** Optional Signal K auth token (JWT). */
  token?: string;
  /** Optional username/password login, used when no token is set. */
  credentials?: Credentials;
}

/**
 * Builds the config from the environment. The Signal K base comes from
 * SIGNALK_HOST/PORT/TLS; KIP is served under it at /@mxtommy/kip/ (overridable
 * with KIP_URL).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const host = env.SIGNALK_HOST?.trim() || 'localhost';
  const port = env.SIGNALK_PORT?.trim() || '3000';
  const protocol = env.SIGNALK_TLS === 'true' ? 'https' : 'http';
  const signalkBaseUrl = `${protocol}://${host}:${port}`;

  const override = env.KIP_URL?.trim();
  const kipBaseUrl = override ? ensureTrailingSlash(override) : `${signalkBaseUrl}/@mxtommy/kip/`;

  const token = env.SIGNALK_TOKEN?.trim();
  const username = env.SIGNALK_USER?.trim();
  const password = env.SIGNALK_PASSWORD?.trim();

  const config: ServerConfig = { signalkBaseUrl, kipBaseUrl };
  if (token) config.token = token;
  if (username && password) config.credentials = { username, password };
  return config;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
