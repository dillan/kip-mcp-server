/**
 * MCP tool definitions and dispatch for the design-vocabulary tools.
 *
 * The dispatch (`callTool`) is kept separate from the MCP transport wiring so it
 * can be tested directly.
 */
import { z } from 'zod';
import { readResourceText } from './resources.js';
import type { KipDashboardSchema } from './schema/schema-types.js';
import { kipObject, READ_ONLY_LOCAL, type ToolSpec } from './tool-spec.js';
import { checkDashboardUx } from './ux/check-dashboard.js';
import { validateDashboard } from './validators.js';
import { getDesignSystem, getUnitOptions, getWidgetSchema, listWidgets } from './vocabulary.js';
import { buildKipConfig } from './write/config-builder.js';

export class ToolError extends Error {
  override name = 'ToolError';
}

const CATEGORY_ENUM = ['Core', 'Gauge', 'Component', 'Racing'] as const;

export const VOCAB_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'get_kip_initial_context',
    title: 'KIP initial context',
    description:
      'Start here. Explains how to design KIP dashboards and summarises the available widgets and design system.',
    inputSchema: {},
    outputSchema: {
      overview: z.string(),
      kipVersion: z.string(),
      widgetCount: z.number(),
      categories: z.array(z.string()),
      grid: kipObject,
      colorTokens: z.array(z.string()),
    },
    annotations: READ_ONLY_LOCAL,
  },
  {
    name: 'list_kip_widgets',
    title: 'List KIP widgets',
    description:
      "List KIP's widget catalog, optionally filtered by category or to widgets that need no plugins.",
    inputSchema: {
      category: z.enum(CATEGORY_ENUM).optional().describe('Only list widgets in this category.'),
      requiresNoPlugins: z
        .boolean()
        .optional()
        .describe('Only list widgets that work with no Signal K plugins.'),
    },
    outputSchema: { widgets: z.array(kipObject) },
    annotations: READ_ONLY_LOCAL,
  },
  {
    name: 'get_widget_schema',
    title: 'Get widget schema',
    description: "Get one widget's default config, binding kind and data path slots.",
    inputSchema: { selector: z.string().describe('Widget selector, e.g. widget-numeric.') },
    outputSchema: { widget: kipObject },
    annotations: READ_ONLY_LOCAL,
  },
  {
    name: 'get_design_system',
    title: 'Get design system',
    description:
      "Get KIP's design system: grid, colour tokens, theme names, dashboard icons and unit groups.",
    inputSchema: {},
    outputSchema: {
      grid: kipObject,
      colors: z.array(kipObject),
      themeNames: z.array(z.string()),
      icons: z.array(z.string()),
      unitGroups: z.array(kipObject),
    },
    annotations: READ_ONLY_LOCAL,
  },
  {
    name: 'get_unit_options',
    title: 'Get unit options',
    description:
      'For a Signal K base unit (e.g. rad, m/s, K, Pa), list the KIP unit group and convertible measures.',
    inputSchema: { skUnit: z.string().describe('Signal K base unit, e.g. rad.') },
    outputSchema: {
      found: z.boolean(),
      skUnit: z.string(),
      note: z.string().optional(),
      group: z.string().optional(),
      measures: z.array(kipObject).optional(),
    },
    annotations: READ_ONLY_LOCAL,
  },
  {
    name: 'validate_kip_config',
    title: 'Validate KIP dashboard',
    description:
      'Validate a KIP dashboard object: structure, the widget-host2 invariants (id===uuid, known widget types), grid bounds, overlaps, and colour/icon/unit sanity. Returns errors and warnings.',
    inputSchema: { dashboard: kipObject.describe('A KIP dashboard object.') },
    outputSchema: {
      ok: z.boolean(),
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
    },
    annotations: READ_ONLY_LOCAL,
  },
  {
    name: 'export_kip_config',
    title: 'Export KipConfig.json',
    description:
      'Build a complete KipConfig.json from dashboards that a user can import via KIP Settings. Works on any Signal K server (no write to the server). Returns the file contents.',
    inputSchema: {
      dashboards: z.array(kipObject).describe('Dashboards to include.'),
      theme: z.string().optional().describe("Theme name (default '')."),
      units: z
        .record(z.string(), z.string())
        .optional()
        .describe('Unit-default overrides, e.g. { Speed: "kph" }.'),
    },
    outputSchema: { filename: z.string(), json: z.string() },
    annotations: READ_ONLY_LOCAL,
  },
  {
    name: 'check_dashboard_ux',
    title: 'Check dashboard UX',
    description:
      'Deterministic UX lint for a KIP dashboard: flags raw/missing labels, duplicate paths, overlapping grid cells, mixed units, and inconsistent precision. Anchors a UX review (see the kip://ux-review-guide resource); it judges objective consistency only, not impact or legibility.',
    inputSchema: { dashboard: kipObject.describe('A KIP dashboard object.') },
    outputSchema: {
      ok: z.boolean(),
      summary: z.string(),
      rawPathLabels: z.array(kipObject),
      duplicatePaths: z.array(kipObject),
      overlappingCells: z.array(kipObject),
      mixedUnits: z.array(kipObject),
      inconsistentPrecision: z.array(kipObject),
    },
    annotations: READ_ONLY_LOCAL,
  },
];

/** Runs a tool by name and returns its structured result. Throws ToolError on bad input. */
export function callTool(
  schema: KipDashboardSchema,
  name: string,
  args: Record<string, unknown> = {},
): unknown {
  switch (name) {
    case 'get_kip_initial_context':
      return getInitialContext(schema);

    case 'list_kip_widgets': {
      const filter: { category?: string; requiresNoPlugins?: boolean } = {};
      if (typeof args.category === 'string') filter.category = args.category;
      if (typeof args.requiresNoPlugins === 'boolean')
        filter.requiresNoPlugins = args.requiresNoPlugins;
      return { widgets: listWidgets(schema, filter) };
    }

    case 'get_widget_schema': {
      const selector = typeof args.selector === 'string' ? args.selector : '';
      const widget = getWidgetSchema(schema, selector);
      if (!widget) {
        throw new ToolError(
          `Unknown widget selector "${selector}". Call list_kip_widgets for valid selectors.`,
        );
      }
      return { widget };
    }

    case 'get_design_system':
      return getDesignSystem(schema);

    case 'validate_kip_config':
      return validateDashboard(args.dashboard, schema);

    case 'check_dashboard_ux':
      return checkDashboardUx(args.dashboard);

    case 'export_kip_config': {
      const dashboards = Array.isArray(args.dashboards) ? args.dashboards : [];
      const options: { theme?: string; units?: Record<string, string> } = {};
      if (typeof args.theme === 'string') options.theme = args.theme;
      if (args.units && typeof args.units === 'object') {
        options.units = args.units as Record<string, string>;
      }
      const config = buildKipConfig(schema, dashboards, options);
      return { filename: 'KipConfig.json', json: JSON.stringify(config, null, 2) };
    }

    case 'get_unit_options': {
      const skUnit = typeof args.skUnit === 'string' ? args.skUnit : '';
      const options = getUnitOptions(schema, skUnit);
      if (!options) {
        return {
          found: false,
          skUnit,
          note: `No KIP unit group contains the Signal K unit "${skUnit}".`,
        };
      }
      return { found: true, ...options };
    }

    default:
      throw new ToolError(`Unknown tool "${name}".`);
  }
}

function getInitialContext(schema: KipDashboardSchema): Record<string, unknown> {
  const categories = [...new Set(schema.widgets.map((w) => w.category))].sort();
  return {
    overview: readResourceText('kip-initial-context.md'),
    kipVersion: schema.meta.kipVersion,
    widgetCount: schema.widgets.length,
    categories,
    grid: schema.designSystem.grid,
    colorTokens: schema.designSystem.colors.map((c) => c.value),
  };
}
