/**
 * MCP tool definitions and dispatch for composing dashboards. These discover the
 * boat's live data (via an SkClient) and design dashboards from the templates.
 */
import { v4 as uuidv4 } from 'uuid';
import { composeDashboard, previewAscii, type Dashboard } from './compose/dashboard-builder.js';
import type { ResolveContext } from './compose/resolver.js';
import { getTemplate, TEMPLATES } from './compose/templates.js';
import { discoverInventory } from './discovery/discover.js';
import type { SkClient } from './discovery/sk-client.js';
import type { KipDashboardSchema } from './schema/schema-types.js';
import { ToolError, type ToolDefinition } from './tools.js';

const INTENT_IDS = TEMPLATES.map((t) => t.id);

export const COMPOSE_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'compose_dashboard',
    description:
      "Design one KIP dashboard for an intent by binding widgets to the boat's data. Returns the dashboard, an ASCII preview, and what was left out. Does not write anything.",
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: INTENT_IDS, description: 'Which dashboard to design.' },
        name: { type: 'string', description: 'Override the dashboard name.' },
        icon: { type: 'string', description: 'Override the dashboard icon.' },
      },
      required: ['intent'],
      additionalProperties: false,
    },
  },
  {
    name: 'recommend_dashboard_set',
    description:
      "Recommend a set of KIP dashboards for this boat: the use-case dashboards its data supports, each with a preview. Does not write anything.",
    inputSchema: {
      type: 'object',
      properties: {
        intents: {
          type: 'array',
          items: { type: 'string', enum: INTENT_IDS },
          description: 'Limit to these intents (default: all that the boat supports).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'preview_dashboard',
    description: 'Render an ASCII preview of a dashboard object (as returned by compose_dashboard).',
    inputSchema: {
      type: 'object',
      properties: { dashboard: { type: 'object' } },
      required: ['dashboard'],
      additionalProperties: false,
    },
  },
];

export const COMPOSE_TOOL_NAMES: ReadonlySet<string> = new Set(
  COMPOSE_TOOL_DEFINITIONS.map((t) => t.name),
);

/** Runs a compose tool, discovering the boat's data as needed. */
export async function callComposeTool(
  schema: KipDashboardSchema,
  sk: SkClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  switch (name) {
    case 'compose_dashboard': {
      const intent = typeof args.intent === 'string' ? args.intent : '';
      const template = getTemplate(intent);
      if (!template) {
        throw new ToolError(`Unknown intent "${intent}". Known intents: ${INTENT_IDS.join(', ')}.`);
      }
      const ctx = await buildContext(schema, sk);
      const override = {
        ...(typeof args.name === 'string' ? { name: args.name } : {}),
        ...(typeof args.icon === 'string' ? { icon: args.icon } : {}),
      };
      const result = composeDashboard(template, ctx, uuidv4, override);
      return {
        dashboard: result.dashboard,
        dropped: result.dropped,
        notes: result.notes,
        preview: previewAscii(result.dashboard),
      };
    }

    case 'recommend_dashboard_set': {
      const wanted = Array.isArray(args.intents) ? new Set(args.intents.map(String)) : null;
      const ctx = await buildContext(schema, sk);
      const dashboards = [];
      for (const template of TEMPLATES) {
        if (wanted && !wanted.has(template.id)) continue;
        const result = composeDashboard(template, ctx, uuidv4);
        if (result.dashboard.configuration.length === 0) continue;
        dashboards.push({
          intent: template.id,
          dashboard: result.dashboard,
          dropped: result.dropped,
          notes: result.notes,
          preview: previewAscii(result.dashboard),
        });
      }
      const built = new Set(dashboards.map((d) => d.intent));
      return { dashboards, unsupported: INTENT_IDS.filter((id) => !built.has(id)) };
    }

    case 'preview_dashboard':
      return { ascii: previewAscii(args.dashboard as Dashboard) };

    default:
      throw new ToolError(`Unknown compose tool "${name}".`);
  }
}

async function buildContext(schema: KipDashboardSchema, sk: SkClient): Promise<ResolveContext> {
  const discovery = await discoverInventory(sk);
  return {
    schema,
    inventory: discovery.paths,
    plugins: discovery.plugins,
    capabilities: discovery.capabilities,
  };
}
