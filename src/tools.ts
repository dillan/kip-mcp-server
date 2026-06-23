/**
 * MCP tool definitions and dispatch for the design-vocabulary tools.
 *
 * The dispatch (`callTool`) is kept separate from the MCP transport wiring so it
 * can be tested directly.
 */
import { readResourceText } from './resources.js';
import type { KipDashboardSchema } from './schema/schema-types.js';
import { validateDashboard } from './validators.js';
import { getDesignSystem, getUnitOptions, getWidgetSchema, listWidgets } from './vocabulary.js';

export class ToolError extends Error {
  override name = 'ToolError';
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const CATEGORY_ENUM = ['Core', 'Gauge', 'Component', 'Racing'];

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_kip_initial_context',
    description:
      'Start here. Explains how to design KIP dashboards and summarises the available widgets and design system.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_kip_widgets',
    description:
      "List KIP's widget catalog, optionally filtered by category or to widgets that need no plugins.",
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: CATEGORY_ENUM, description: 'Only list widgets in this category.' },
        requiresNoPlugins: {
          type: 'boolean',
          description: 'Only list widgets that work with no Signal K plugins.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_widget_schema',
    description: "Get one widget's default config, binding kind and data path slots.",
    inputSchema: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'Widget selector, e.g. widget-numeric.' } },
      required: ['selector'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_design_system',
    description:
      "Get KIP's design system: grid, colour tokens, theme names, dashboard icons and unit groups.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_unit_options',
    description:
      'For a Signal K base unit (e.g. rad, m/s, K, Pa), list the KIP unit group and convertible measures.',
    inputSchema: {
      type: 'object',
      properties: { skUnit: { type: 'string', description: 'Signal K base unit, e.g. rad.' } },
      required: ['skUnit'],
      additionalProperties: false,
    },
  },
  {
    name: 'validate_kip_config',
    description:
      'Validate a KIP dashboard object: structure, the widget-host2 invariants (id===uuid, known widget types), grid bounds, overlaps, and colour/icon/unit sanity. Returns errors and warnings.',
    inputSchema: {
      type: 'object',
      properties: { dashboard: { type: 'object', description: 'A KIP dashboard object.' } },
      required: ['dashboard'],
      additionalProperties: false,
    },
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
      if (typeof args.requiresNoPlugins === 'boolean') filter.requiresNoPlugins = args.requiresNoPlugins;
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

    case 'get_unit_options': {
      const skUnit = typeof args.skUnit === 'string' ? args.skUnit : '';
      const options = getUnitOptions(schema, skUnit);
      if (!options) {
        return { found: false, skUnit, note: `No KIP unit group contains the Signal K unit "${skUnit}".` };
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
