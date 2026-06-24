/**
 * MCP tool definitions and dispatch for the Signal K data-discovery tools.
 * These need a live Signal K server (an SkClient).
 */
import { z } from 'zod';
import { discoverInventory } from './discovery/discover.js';
import { flattenVesselData } from './discovery/inventory.js';
import { paginate, type PageOptions } from './discovery/pagination.js';
import type { SkClient } from './discovery/sk-client.js';
import {
  kipObject,
  makeProgressReporter,
  READ_ONLY_REMOTE,
  type ToolCtx,
  type ToolSpec,
} from './tool-spec.js';
import { ToolError } from './tools.js';

/** Shared opt-in pagination inputs for the path-listing tools. */
const PAGE_INPUT = {
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe('Maximum paths to return. Omit to return all; with it, page using nextCursor.'),
  cursor: z
    .string()
    .optional()
    .describe('Opaque token from a previous response, to fetch the next page.'),
} satisfies z.ZodRawShape;

function pageOptions(args: Record<string, unknown>): PageOptions {
  return {
    limit: typeof args.limit === 'number' ? args.limit : undefined,
    cursor: typeof args.cursor === 'string' ? args.cursor : undefined,
  };
}

export const DISCOVERY_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'analyze_signalk_data',
    title: 'Analyse Signal K data',
    description:
      "Analyse the boat's Signal K data: the available paths with units, the vessel capabilities, and installed plugins. Use this before recommending dashboards.",
    inputSchema: { ...PAGE_INPUT },
    outputSchema: {
      server: kipObject,
      capabilities: kipObject,
      pathCount: z.number(),
      paths: z.array(kipObject),
      plugins: z.array(kipObject),
      nextCursor: z.string().optional(),
    },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'list_available_paths',
    title: 'List available paths',
    description:
      'List the Signal K data paths available on the boat, optionally filtered by prefix.',
    inputSchema: {
      prefix: z.string().optional().describe('Only list paths starting with this prefix.'),
      ...PAGE_INPUT,
    },
    outputSchema: { paths: z.array(z.string()), nextCursor: z.string().optional() },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'get_path_meta',
    title: 'Get path metadata',
    description:
      'Get metadata (units, description, value type, zones) for specific Signal K paths.',
    inputSchema: { paths: z.array(z.string()).describe('Paths to describe.') },
    outputSchema: { meta: z.array(kipObject) },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'get_path_sources',
    title: 'Get path sources',
    description:
      'List the data sources reporting each Signal K path, and which source the server currently serves as the active one.',
    inputSchema: {
      paths: z.array(z.string()).describe('Paths to list the sources for.'),
    },
    outputSchema: { sources: z.array(kipObject) },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'get_server_info',
    title: 'Get Signal K server info',
    description: 'Get the Signal K server version and id.',
    inputSchema: {},
    outputSchema: { version: z.string(), serverId: z.string().optional() },
    annotations: READ_ONLY_REMOTE,
  },
  {
    name: 'list_installed_plugins',
    title: 'List installed plugins',
    description: 'List the Signal K server plugins and whether each is enabled.',
    inputSchema: {},
    outputSchema: { plugins: z.array(kipObject) },
    annotations: READ_ONLY_REMOTE,
  },
];

export const DISCOVERY_TOOL_NAMES: ReadonlySet<string> = new Set(
  DISCOVERY_TOOL_SPECS.map((t) => t.name),
);

/** Runs a discovery tool against a live Signal K server. */
export async function callDiscoveryTool(
  sk: SkClient,
  name: string,
  args: Record<string, unknown> = {},
  ctx?: ToolCtx,
): Promise<unknown> {
  switch (name) {
    case 'analyze_signalk_data': {
      const report = makeProgressReporter(ctx);
      await report(0, 2, 'Fetching Signal K data');
      const result = await discoverInventory(sk);
      await report(2, 2, 'Analysis complete');
      const page = paginate(result.paths, pageOptions(args));
      return {
        server: result.server,
        capabilities: result.capabilities,
        pathCount: result.paths.length,
        paths: page.items,
        plugins: result.plugins,
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      };
    }

    case 'list_available_paths': {
      const all = flattenVesselData(await sk.getVesselSelf()).map((p) => p.path);
      const prefix = typeof args.prefix === 'string' ? args.prefix : '';
      const filtered = prefix ? all.filter((p) => p.startsWith(prefix)) : all;
      const page = paginate(filtered, pageOptions(args));
      return { paths: page.items, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) };
    }

    case 'get_path_meta': {
      const wanted = new Set(Array.isArray(args.paths) ? args.paths.map(String) : []);
      const meta = flattenVesselData(await sk.getVesselSelf()).filter((p) => wanted.has(p.path));
      return { meta };
    }

    case 'get_path_sources': {
      const wanted = new Set(Array.isArray(args.paths) ? args.paths.map(String) : []);
      const sources = flattenVesselData(await sk.getVesselSelf())
        .filter((p) => wanted.has(p.path))
        .map((p) => ({
          path: p.path,
          defaultSource: p.defaultSource,
          sources: p.sources,
          sourceCount: p.sourceCount,
        }));
      return { sources };
    }

    case 'get_server_info':
      return await sk.getServerInfo();

    case 'list_installed_plugins':
      return { plugins: await sk.getPlugins() };

    default:
      throw new ToolError(`Unknown discovery tool "${name}".`);
  }
}
