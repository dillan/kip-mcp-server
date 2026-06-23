/**
 * MCP tool definitions and dispatch for the Signal K data-discovery tools.
 * These need a live Signal K server (an SkClient).
 */
import { discoverInventory } from './discovery/discover.js';
import { flattenVesselData } from './discovery/inventory.js';
import type { SkClient } from './discovery/sk-client.js';
import { ToolError, type ToolDefinition } from './tools.js';

export const DISCOVERY_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'analyze_signalk_data',
    description:
      "Analyse the boat's Signal K data: the available paths with units, the vessel capabilities, and installed plugins. Use this before recommending dashboards.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_available_paths',
    description: 'List the Signal K data paths available on the boat, optionally filtered by prefix.',
    inputSchema: {
      type: 'object',
      properties: { prefix: { type: 'string', description: 'Only list paths starting with this prefix.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_path_meta',
    description: 'Get metadata (units, description, value type, zones) for specific Signal K paths.',
    inputSchema: {
      type: 'object',
      properties: { paths: { type: 'array', items: { type: 'string' }, description: 'Paths to describe.' } },
      required: ['paths'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_server_info',
    description: 'Get the Signal K server version and id.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_installed_plugins',
    description: 'List the Signal K server plugins and whether each is enabled.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

export const DISCOVERY_TOOL_NAMES: ReadonlySet<string> = new Set(
  DISCOVERY_TOOL_DEFINITIONS.map((t) => t.name),
);

/** Runs a discovery tool against a live Signal K server. */
export async function callDiscoveryTool(
  sk: SkClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  switch (name) {
    case 'analyze_signalk_data': {
      const result = await discoverInventory(sk);
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
