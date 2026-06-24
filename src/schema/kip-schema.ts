import { readFileSync } from 'node:fs';
import { resourcePath } from '../utils/paths.js';
import type { KipDashboardSchema } from './schema-types.js';

const SCHEMA_ASSET = 'assets/kip-dashboard-schema.json';

export interface LoadResult {
  schema: KipDashboardSchema;
  /** `remote` when fetched from the running KIP; `bundled` when the fallback was used. */
  source: 'remote' | 'bundled';
  /** Set when the bundled fallback was used, so the caller can flag version skew. */
  warning?: string;
}

export interface LoadOptions {
  /** KIP webapp base URL, e.g. `http://host:3000/@mxtommy/kip/` (trailing slash optional). */
  baseUrl: string;
  /** Injectable fetch (defaults to global fetch). */
  fetchImpl?: typeof fetch;
  /** Injectable bundled loader (defaults to reading the shipped fallback). */
  loadBundled?: () => KipDashboardSchema;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

let cachedBundled: KipDashboardSchema | undefined;

/** Reads the bundled fallback schema shipped with this package (parsed once). */
export function loadBundledSchema(): KipDashboardSchema {
  if (!cachedBundled) {
    cachedBundled = JSON.parse(
      readFileSync(resourcePath('bundled-schema.json'), 'utf8'),
    ) as KipDashboardSchema;
  }
  return cachedBundled;
}

class AuthError extends Error {
  override name = 'AuthError';
}

/**
 * Loads the KIP schema, preferring the live copy served by the running KIP at
 * `<baseUrl>/assets/kip-dashboard-schema.json`.
 *
 *  - 200            use the live schema (source `remote`).
 *  - 404 / network  fall back to the bundled copy with a version-skew warning.
 *  - 401 / 403      throw an actionable auth error (never a silent fallback,
 *                   which would hide a real configuration problem).
 */
export async function loadKipSchema(opts: LoadOptions): Promise<LoadResult> {
  const { baseUrl, fetchImpl = fetch, loadBundled = loadBundledSchema, timeoutMs = 5000 } = opts;
  const url = new URL(SCHEMA_ASSET, ensureTrailingSlash(baseUrl)).toString();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        `KIP returned HTTP ${response.status} when fetching its schema. The server needs a ` +
          `valid token or login — set SIGNALK_TOKEN, or SIGNALK_USER and SIGNALK_PASSWORD.`,
      );
    }
    if (!response.ok) {
      return fallback(loadBundled, `KIP schema not found at ${url} (HTTP ${response.status}).`);
    }
    const schema = (await response.json()) as KipDashboardSchema;
    return { schema, source: 'remote' };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    return fallback(loadBundled, `Could not reach KIP at ${url} (${reason}).`);
  }
}

function fallback(loadBundled: () => KipDashboardSchema, why: string): LoadResult {
  const schema = loadBundled();
  return {
    schema,
    source: 'bundled',
    warning:
      `${why} Using the bundled schema generated for KIP ${schema.meta.kipVersion}, ` +
      `which may differ from your installed KIP.`,
  };
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export { SCHEMA_ASSET };
