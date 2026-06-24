import type { KipDashboardSchema } from '../schema/schema-types.js';
import { buildKipConfig, validateConfigForWrite, type KipConfig } from './config-builder.js';

export type ApplyMode = 'append-dashboards' | 'replace-dashboards' | 'full-replace';

export interface ApplyPlanParams {
  schema: KipDashboardSchema;
  dashboards: unknown[];
  /** The config currently stored on the server, or null if it doesn't exist yet. */
  existing: KipConfig | null;
  configName: string;
  mode: ApplyMode;
}

export interface ApplyRequest {
  kind: 'post-full' | 'patch-dashboards';
  /** The full IConfig (post-full) or the dashboards array (patch-dashboards). */
  body: unknown;
  summary: string;
}

export interface ApplyPlan {
  requests: ApplyRequest[];
  warnings: string[];
  errors: string[];
}

/**
 * Builds the write plan without touching the network (the dry-run output).
 *
 *  - No existing config → seed a full POST (a dashboards-only patch fails on a
 *    missing document, so we never do that first).
 *  - full-replace → POST a full config, keeping the existing app/theme.
 *  - append/replace dashboards → JSON-Patch the dashboards array only.
 */
export function buildApplyPlan(params: ApplyPlanParams): ApplyPlan {
  const { schema, dashboards, existing, configName, mode } = params;
  const warnings: string[] = [];
  const errors: string[] = [];

  const sharedNameNote =
    `Writes config "${configName}"; KIP shows it only if its connection ` +
    `sharedConfigName == "${configName}", which can't be verified from here.`;

  if (!existing) {
    const config = buildKipConfig(schema, dashboards);
    errors.push(...validateConfigForWrite(config, schema.meta.configVersion).errors);
    warnings.push(`Config "${configName}" does not exist yet; seeding a full config.`);
    warnings.push(sharedNameNote);
    return {
      requests: [
        { kind: 'post-full', body: config, summary: `Create config "${configName}" (full POST)` },
      ],
      warnings,
      errors,
    };
  }

  if (mode === 'full-replace') {
    const config = buildKipConfig(schema, dashboards, { baseConfig: existing });
    errors.push(...validateConfigForWrite(config, schema.meta.configVersion).errors);
    warnings.push(sharedNameNote);
    return {
      requests: [
        {
          kind: 'post-full',
          body: config,
          summary: `Replace "${configName}" (keep existing app/theme)`,
        },
      ],
      warnings,
      errors,
    };
  }

  const existingDashboards = Array.isArray(existing.dashboards) ? existing.dashboards : [];
  const merged = mode === 'append-dashboards' ? [...existingDashboards, ...dashboards] : dashboards;
  warnings.push(sharedNameNote);
  return {
    requests: [
      {
        kind: 'patch-dashboards',
        body: merged,
        summary: `${mode} on "${configName}" (${merged.length} dashboards total)`,
      },
    ],
    warnings,
    errors,
  };
}

/** True when a Signal K server version supports the applicationData store (>= 1.27.0). */
export function supportsApplicationData(version: string): boolean {
  const match = /^(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 1 || (major === 1 && minor >= 27);
}
