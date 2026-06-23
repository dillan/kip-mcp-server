/**
 * MCP tool definitions and dispatch for composing dashboards. These discover the
 * boat's live data (via an SkClient) and design dashboards from the templates.
 */
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { composeDashboard, previewAscii, type Dashboard } from './compose/dashboard-builder.js';
import type { ResolveContext } from './compose/resolver.js';
import { getTemplate, TEMPLATES } from './compose/templates.js';
import { discoverInventory } from './discovery/discover.js';
import type { SkClient } from './discovery/sk-client.js';
import type { KipDashboardSchema } from './schema/schema-types.js';
import {
  kipObject,
  makeProgressReporter,
  READ_ONLY_LOCAL,
  READ_ONLY_REMOTE,
  type ToolCtx,
  type ToolSpec,
} from './tool-spec.js';
import { ToolError } from './tools.js';

const INTENT_IDS = TEMPLATES.map((t) => t.id);
const droppedSchema = z.array(z.object({ selector: z.string(), reason: z.string() }));

export const COMPOSE_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'compose_dashboard',
    title: 'Compose a dashboard',
    description:
      "Design one KIP dashboard for an intent by binding widgets to the boat's data. Returns the dashboard, an ASCII preview, and what was left out. Does not write anything.",
    inputSchema: {
      intent: z.enum(INTENT_IDS).describe('Which dashboard to design.'),
      name: z.string().optional().describe('Override the dashboard name.'),
      icon: z.string().optional().describe('Override the dashboard icon.'),
    },
    outputSchema: {
      dashboard: kipObject,
      dropped: droppedSchema,
      notes: z.array(z.string()),
      preview: z.string(),
    },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'recommend_dashboard_set',
    title: 'Recommend a dashboard set',
    description:
      "Recommend a set of KIP dashboards for this boat: the use-case dashboards its data supports, each with a preview. Does not write anything.",
    inputSchema: {
      intents: z
        .array(z.enum(INTENT_IDS))
        .optional()
        .describe('Limit to these intents (default: all that the boat supports).'),
    },
    outputSchema: {
      dashboards: z.array(kipObject),
      unsupported: z.array(z.string()),
    },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'preview_dashboard',
    title: 'Preview a dashboard',
    description: 'Render an ASCII preview of a dashboard object (as returned by compose_dashboard).',
    inputSchema: { dashboard: kipObject.describe('A KIP dashboard object.') },
    outputSchema: { ascii: z.string() },
    annotations: READ_ONLY_LOCAL,
  },
];

export const COMPOSE_TOOL_NAMES: ReadonlySet<string> = new Set(
  COMPOSE_TOOL_SPECS.map((t) => t.name),
);

/** Runs a compose tool, discovering the boat's data as needed. */
export async function callComposeTool(
  schema: KipDashboardSchema,
  sk: SkClient,
  name: string,
  args: Record<string, unknown> = {},
  ctx?: ToolCtx,
): Promise<unknown> {
  switch (name) {
    case 'compose_dashboard': {
      const intent = typeof args.intent === 'string' ? args.intent : '';
      const template = getTemplate(intent);
      if (!template) {
        throw new ToolError(`Unknown intent "${intent}". Known intents: ${INTENT_IDS.join(', ')}.`);
      }
      const resolveCtx = await buildContext(schema, sk);
      const override = {
        ...(typeof args.name === 'string' ? { name: args.name } : {}),
        ...(typeof args.icon === 'string' ? { icon: args.icon } : {}),
      };
      const result = composeDashboard(template, resolveCtx, uuidv4, override);
      return {
        dashboard: result.dashboard,
        dropped: result.dropped,
        notes: result.notes,
        preview: previewAscii(result.dashboard),
      };
    }

    case 'recommend_dashboard_set': {
      const wanted = Array.isArray(args.intents) ? new Set(args.intents.map(String)) : null;
      const report = makeProgressReporter(ctx);
      const total = TEMPLATES.length + 1;
      await report(0, total, 'Discovering boat data');
      const resolveCtx = await buildContext(schema, sk);
      const dashboards = [];
      for (let i = 0; i < TEMPLATES.length; i++) {
        const template = TEMPLATES[i];
        if (!wanted || wanted.has(template.id)) {
          const result = composeDashboard(template, resolveCtx, uuidv4);
          if (result.dashboard.configuration.length > 0) {
            dashboards.push({
              intent: template.id,
              dashboard: result.dashboard,
              dropped: result.dropped,
              notes: result.notes,
              preview: previewAscii(result.dashboard),
            });
          }
        }
        await report(i + 1, total, `Evaluated ${template.id}`);
      }
      const built = new Set(dashboards.map((d) => d.intent));
      await report(total, total, 'Recommendations ready');
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
