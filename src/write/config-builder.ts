import type { KipDashboardSchema } from '../schema/schema-types.js';

export interface KipConfig {
  app: Record<string, unknown>;
  theme: { themeName: string };
  dashboards: unknown[];
}

export interface BuildConfigOptions {
  /** Theme name (default ''). Ignored when baseConfig is given. */
  theme?: string;
  /** Unit-default overrides, e.g. { Speed: 'kph' }. */
  units?: Record<string, string>;
  /** Start from an existing config (its app/theme are preserved). */
  baseConfig?: KipConfig;
}

/**
 * Builds a complete KIP config from dashboards, always carrying a full `app`
 * block and stamping `app.configVersion` from the schema. STUB.
 */
export function buildKipConfig(
  _schema: KipDashboardSchema,
  _dashboards: unknown[],
  _options: BuildConfigOptions = {},
): KipConfig {
  throw new Error('not implemented');
}

/**
 * Checks a config is safe to write to KIP: a complete `app` block and the exact
 * expected `configVersion`. STUB.
 */
export function validateConfigForWrite(
  _config: unknown,
  _expectedConfigVersion: number,
): { ok: boolean; errors: string[] } {
  return { ok: true, errors: [] };
}
