import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { callComposeTool, COMPOSE_TOOL_DEFINITIONS, COMPOSE_TOOL_NAMES } from './compose-tools.js';
import { loadConfig } from './config.js';
import { callDiscoveryTool, DISCOVERY_TOOL_DEFINITIONS, DISCOVERY_TOOL_NAMES } from './discovery-tools.js';
import { SkClient } from './discovery/sk-client.js';
import { readResourceText } from './resources.js';
import { loadKipSchema } from './schema/kip-schema.js';
import type { KipDashboardSchema } from './schema/schema-types.js';
import { callTool, TOOL_DEFINITIONS } from './tools.js';
import { callWriteTool, WRITE_TOOL_DEFINITIONS, WRITE_TOOL_NAMES } from './write-tools.js';
import { SkAppDataClient } from './write/appdata-client.js';

const SERVER_NAME = 'kip-mcp-server';
const SERVER_VERSION = '0.0.0';

interface SchemaResult {
  schema: KipDashboardSchema;
  source: 'remote' | 'bundled';
  warning?: string;
}

export interface KipMCPServerOptions {
  /** Inject a schema (mainly for tests), skipping the runtime fetch. */
  schema?: KipDashboardSchema;
  /** Inject a schema loader (mainly for tests). */
  loadSchema?: () => Promise<SchemaResult>;
  /** Inject a Signal K client (mainly for tests). */
  sk?: SkClient;
}

const RESOURCES = [
  {
    uri: 'kip://widget_catalog',
    name: 'KIP widget catalog',
    description: 'Every KIP widget with its default config, binding kind and data path slots.',
    mimeType: 'application/json',
  },
  {
    uri: 'kip://design_system',
    name: 'KIP design system',
    description: 'Grid, colour tokens, theme names, dashboard icons and unit groups.',
    mimeType: 'application/json',
  },
  {
    uri: 'kip://initial_context',
    name: 'KIP dashboard design guide',
    description: 'How to design KIP dashboards with this server.',
    mimeType: 'text/markdown',
  },
];

/**
 * The KIP MCP server: exposes the design-vocabulary tools and resources over MCP.
 * The heavy logic lives in tested modules (tools, vocabulary, schema); this class
 * is the thin wiring to the Model Context Protocol.
 */
export class KipMCPServer {
  private readonly server: Server;
  private readonly loadSchemaFn: () => Promise<SchemaResult>;
  private readonly sk: SkClient;
  private readonly appData: SkAppDataClient;
  private schema?: KipDashboardSchema;

  constructor(options: KipMCPServerOptions = {}) {
    const config = loadConfig();
    this.schema = options.schema;
    this.loadSchemaFn = options.loadSchema ?? (() => loadKipSchema({ baseUrl: config.kipBaseUrl }));
    this.sk = options.sk ?? new SkClient({ baseUrl: config.signalkBaseUrl, token: config.token });
    this.appData = new SkAppDataClient({ baseUrl: config.signalkBaseUrl, token: config.token });
    this.server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {}, resources: {} } },
    );
    this.registerHandlers();
  }

  private async getSchema(): Promise<KipDashboardSchema> {
    if (!this.schema) {
      const result = await this.loadSchemaFn();
      this.schema = result.schema;
      if (result.warning) {
        console.error(`[kip-mcp-server] ${result.warning}`);
      }
    }
    return this.schema;
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        ...TOOL_DEFINITIONS,
        ...DISCOVERY_TOOL_DEFINITIONS,
        ...COMPOSE_TOOL_DEFINITIONS,
        ...WRITE_TOOL_DEFINITIONS,
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name } = request.params;
      const args = request.params.arguments ?? {};
      try {
        let result: unknown;
        if (DISCOVERY_TOOL_NAMES.has(name)) {
          result = await callDiscoveryTool(this.sk, name, args);
        } else if (COMPOSE_TOOL_NAMES.has(name)) {
          result = await callComposeTool(await this.getSchema(), this.sk, name, args);
        } else if (WRITE_TOOL_NAMES.has(name)) {
          result = await callWriteTool(await this.getSchema(), this.appData, this.sk, name, args);
        } else {
          result = callTool(await this.getSchema(), name, args);
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, () => ({ resources: RESOURCES }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const schema = await this.getSchema();
      const text = this.readResource(uri, schema);
      const mimeType = uri === 'kip://initial_context' ? 'text/markdown' : 'application/json';
      return { contents: [{ uri, mimeType, text }] };
    });
  }

  private readResource(uri: string, schema: KipDashboardSchema): string {
    switch (uri) {
      case 'kip://widget_catalog':
        return JSON.stringify(schema.widgets, null, 2);
      case 'kip://design_system':
        return JSON.stringify(schema.designSystem, null, 2);
      case 'kip://initial_context':
        return readResourceText('kip-initial-context.md');
      default:
        throw new Error(`Unknown resource "${uri}".`);
    }
  }

  /** Connects the server to a transport (used by tests with an in-memory transport). */
  async connect(transport: Parameters<Server['connect']>[0]): Promise<void> {
    await this.server.connect(transport);
  }

  /** Runs the server over stdio. */
  async run(): Promise<void> {
    await this.connect(new StdioServerTransport());
  }
}
