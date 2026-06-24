import type { KipDashboardSchema } from '../schema/schema-types.js';
import { deriveDataSets } from './datasets.js';
import { makeDefaultApp } from './defaults.js';

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
 * block and stamping `app.configVersion` from the schema. When `baseConfig` is
 * given, its existing `app` and `theme` are preserved.
 */
export function buildKipConfig(
  schema: KipDashboardSchema,
  dashboards: unknown[],
  options: BuildConfigOptions = {},
): KipConfig {
  const app = options.baseConfig?.app
    ? structuredClone(options.baseConfig.app)
    : makeDefaultApp(schema.meta.configVersion);

  // Always stamp the version KIP expects, even when starting from a base config.
  app.configVersion = schema.meta.configVersion;
  // Seed app.dataSets so any data-chart widgets have their data series ready.
  app.dataSets = deriveDataSets(dashboards);
  if (options.units) {
    const current = (app.unitDefaults as Record<string, string> | undefined) ?? {};
    app.unitDefaults = { ...current, ...options.units };
  }

  const theme = options.baseConfig?.theme
    ? structuredClone(options.baseConfig.theme)
    : { themeName: options.theme ?? '' };

  return { app, theme, dashboards };
}

/**
 * Checks a config is safe to write to KIP: a complete `app` block (KIP crashes on
 * load otherwise) and the exact expected `configVersion`.
 */
export function validateConfigForWrite(
  config: unknown,
  expectedConfigVersion: number,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config || typeof config !== 'object') {
    return { ok: false, errors: ['config is not an object'] };
  }
  const c = config as { app?: unknown; theme?: unknown; dashboards?: unknown };

  const app = c.app as Record<string, unknown> | undefined;
  if (!app || typeof app !== 'object') {
    errors.push('config.app is missing');
  } else {
    if (app.configVersion !== expectedConfigVersion) {
      errors.push(`app.configVersion must be ${expectedConfigVersion}`);
    }
    if (!Array.isArray(app.dataSets)) errors.push('app.dataSets must be an array');
    if (
      !app.unitDefaults ||
      typeof app.unitDefaults !== 'object' ||
      Object.keys(app.unitDefaults).length === 0
    ) {
      errors.push('app.unitDefaults must be a non-empty object');
    }
    if (!app.notificationConfig || typeof app.notificationConfig !== 'object') {
      errors.push('app.notificationConfig is missing');
    }
  }

  const theme = c.theme as { themeName?: unknown } | undefined;
  if (!theme || typeof theme.themeName !== 'string') {
    errors.push('theme.themeName must be a string');
  }
  if (!Array.isArray(c.dashboards)) errors.push('config.dashboards must be an array');

  return { ok: errors.length === 0, errors };
}
