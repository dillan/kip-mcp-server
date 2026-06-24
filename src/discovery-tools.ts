/**
 * MCP tool definitions and dispatch for the Signal K data-discovery tools.
 * These need a live Signal K server (an SkClient).
 */
import { z } from 'zod';
import { discoverInventory } from './discovery/discover.js';
import { flattenVesselData } from './discovery/inventory.js';
import type { SkClient } from './discovery/sk-client.js';
import {
  kipObject,
  makeProgressReporter,
  READ_ONLY_REMOTE,
  type ToolCtx,
  type ToolSpec,
} from './tool-spec.js';
import { ToolError } from './tools.js';

export const DISCOVERY_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'analyze_signalk_data',
    title: 'Analyse Signal K data',
    description:
      "Analyse the boat's Signal K data: the available paths with units, the vessel capabilities, and installed plugins. Use this before recommending dashboards.",
    inputSchema: {},
    outputSchema: {
      server: kipObject,
      capabilities: kipObject,
      pathCount: z.number(),
      paths: z.array(kipObject),
      plugins: z.array(kipObject),
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
    },
    outputSchema: { paths: z.array(z.string()) },
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
      return {
        server: result.server,
        capabilities: result.capabilities,
        pathCount: result.paths.length,
        paths: result.paths,
        plugins: result.plugins,
      };
    }

    case 'list_available_paths': {
      const all = flattenVesselData(await sk.getVesselSelf()).map((p) => p.path);
      const prefix = typeof args.prefix === 'string' ? args.prefix : '';
      return { paths: prefix ? all.filter((p) => p.startsWith(prefix)) : all };
    }

    case 'get_path_meta': {
      const wanted = new Set(Array.isArray(args.paths) ? args.paths.map(String) : []);
      const meta = flattenVesselData(await sk.getVesselSelf()).filter((p) => wanted.has(p.path));
      return { meta };
    }

    case 'get_server_info':
      return await sk.getServerInfo();

    case 'list_installed_plugins':
      return { plugins: await sk.getPlugins() };

    default:
      throw new ToolError(`Unknown discovery tool "${name}".`);
  }
}
