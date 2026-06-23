/**
 * MCP tool definitions and dispatch for reading and writing KIP config in the
 * Signal K applicationData store. Writes default to a dry run.
 */
import { z } from 'zod';
import type { SkClient } from './discovery/sk-client.js';
import type { KipDashboardSchema } from './schema/schema-types.js';
import { kipObject, READ_ONLY_REMOTE, WRITE_REMOTE, type ToolSpec } from './tool-spec.js';
import { ToolError } from './tools.js';
import type { SkAppDataClient } from './write/appdata-client.js';
import { buildApplyPlan, supportsApplicationData, type ApplyMode } from './write/apply-plan.js';

const SCOPE_ENUM = ['user', 'global'] as const;
const MODE_ENUM = ['append-dashboards', 'replace-dashboards', 'full-replace'] as const;

export const WRITE_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'read_kip_config',
    title: 'Read KIP config',
    description: 'Read the KIP config stored on the Signal K server, and list the available config names.',
    inputSchema: {
      scope: z.enum(SCOPE_ENUM).optional(),
      configName: z.string().optional(),
      fileVersion: z.number().optional(),
    },
    outputSchema: {
      exists: z.boolean(),
      config: z.unknown().optional(),
      listing: z.array(z.unknown()).optional(),
    },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'backup_kip_config',
    title: 'Back up KIP config',
    description: 'Return the current stored KIP config so it can be kept as a backup before changes.',
    inputSchema: {
      scope: z.enum(SCOPE_ENUM).optional(),
      configName: z.string().optional(),
      fileVersion: z.number().optional(),
    },
    outputSchema: {
      exists: z.boolean(),
      backup: z.unknown().optional(),
    },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'apply_kip_config',
    title: 'Apply KIP config',
    description:
      'Write dashboards to the KIP config on the Signal K server. Dry run by default — it shows what it would do; pass dryRun:false and confirm:true to actually write. Falls back to a file export on old servers.',
    inputSchema: {
      dashboards: z.array(kipObject),
      scope: z.enum(SCOPE_ENUM).optional(),
      configName: z.string().optional(),
      fileVersion: z.number().optional(),
      mode: z.enum(MODE_ENUM).optional(),
      dryRun: z.boolean().optional(),
      confirm: z.boolean().optional(),
    },
    outputSchema: {
      refused: z.boolean().optional(),
      reason: z.string().optional(),
      suggestion: z.string().optional(),
      ok: z.boolean().optional(),
      errors: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
      dryRun: z.boolean().optional(),
      wouldWrite: z.array(z.unknown()).optional(),
      note: z.string().optional(),
      applied: z.boolean().optional(),
      wrote: z.array(z.unknown()).optional(),
    },
    annotations: WRITE_REMOTE,
  },
];

export const WRITE_TOOL_NAMES: ReadonlySet<string> = new Set(WRITE_TOOL_SPECS.map((t) => t.name));

export async function callWriteTool(
  schema: KipDashboardSchema,
  appData: SkAppDataClient,
  sk: SkClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const scope = typeof args.scope === 'string' ? args.scope : 'user';
  const configName = typeof args.configName === 'string' ? args.configName : 'default';
  const fileVersion = typeof args.fileVersion === 'number' ? args.fileVersion : 11;

  switch (name) {
    case 'read_kip_config': {
      const config = await appData.getConfig(scope, configName, fileVersion);
      const listing = await appData.listConfigNames(scope, fileVersion);
      return { exists: config !== null, config, listing };
    }

    case 'backup_kip_config': {
      const config = await appData.getConfig(scope, configName, fileVersion);
      return { exists: config !== null, backup: config };
    }

    case 'apply_kip_config': {
      const dashboards = Array.isArray(args.dashboards) ? args.dashboards : [];
      if (dashboards.length === 0) {
        throw new ToolError('apply_kip_config requires at least one dashboard.');
      }
      const mode = (typeof args.mode === 'string' ? args.mode : 'append-dashboards') as ApplyMode;
      const dryRun = args.dryRun !== false;
      const confirm = args.confirm === true;

      const info = await sk.getServerInfo();
      if (!supportsApplicationData(info.version)) {
        return {
          refused: true,
          reason: `Signal K ${info.version} has no applicationData store (needs >= 1.27).`,
          suggestion: 'Use export_kip_config and import the KipConfig.json via KIP Settings.',
        };
      }

      const existing = await appData.getConfig(scope, configName, fileVersion);
      const plan = buildApplyPlan({ schema, dashboards, existing, configName, mode });
      if (plan.errors.length > 0) {
        return { ok: false, errors: plan.errors, warnings: plan.warnings };
      }
      const summaries = plan.requests.map((r) => r.summary);

      if (dryRun || !confirm) {
        return {
          dryRun: true,
          wouldWrite: summaries,
          warnings: plan.warnings,
          note: 'Re-run with dryRun:false and confirm:true to write.',
        };
      }

      for (const req of plan.requests) {
        if (req.kind === 'post-full') {
          await appData.postFull(scope, configName, fileVersion, req.body);
        } else {
          await appData.patchDashboards(scope, configName, fileVersion, req.body);
        }
      }
      return { applied: true, wrote: summaries, warnings: plan.warnings };
    }

    default:
      throw new ToolError(`Unknown write tool "${name}".`);
  }
}
