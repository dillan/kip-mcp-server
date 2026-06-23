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

/** Reads the bundled fallback schema shipped with this package. */
export function loadBundledSchema(): KipDashboardSchema {
  return JSON.parse(readFileSync(resourcePath('bundled-schema.json'), 'utf8')) as KipDashboardSchema;
}

/**
 * Loads the KIP schema, preferring the live copy served by the running KIP and
 * falling back to the bundled copy when KIP is unreachable.
 *
 * STUB: implemented in the GREEN step.
 */
export async function loadKipSchema(_opts: LoadOptions): Promise<LoadResult> {
  throw new Error('not implemented');
}

export { SCHEMA_ASSET };
