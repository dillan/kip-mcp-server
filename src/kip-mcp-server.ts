import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { callComposeTool, COMPOSE_TOOL_SPECS } from './compose-tools.js';
import { loadConfig, type ServerConfig } from './config.js';
import { callDiscoveryTool, DISCOVERY_TOOL_SPECS } from './discovery-tools.js';
import { SkClient } from './discovery/sk-client.js';
import { callDoctorTool, DOCTOR_TOOL_SPECS } from './doctor-tools.js';
import { PROMPT_SPECS } from './prompts.js';
import {
  completeTemplateId,
  completeWidgetSelector,
  listTemplateResources,
  listWidgetResources,
  readTemplateResource,
  readWidgetResource,
} from './resource-templates.js';
import { readResourceText } from './resources.js';
import { loadKipSchema } from './schema/kip-schema.js';
import type { KipDashboardSchema } from './schema/schema-types.js';
import { TokenProvider } from './signalk/auth.js';
import { toToolResult, type ToolCtx, type ToolSpec } from './tool-spec.js';
import { callTool, VOCAB_TOOL_SPECS } from './tools.js';
import { callWriteTool, WRITE_TOOL_SPECS } from './write-tools.js';
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
  /** Inject an applicationData client (mainly for tests). */
  appData?: SkAppDataClient;
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
  {
    uri: 'kip://ux-review-guide',
    name: 'KIP UX review guide',
    description:
      'How to review a KIP dashboard for marine UX: the six passes, severity rubric, and output format. Used by the review_dashboard prompt.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'kip://ux-laws',
    name: 'Laws of UX for marine dashboards',
    description: 'The codified Laws of UX, each translated to a KIP marine instrument display.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'kip://ux-conventions',
    name: 'KIP and marine conventions',
    description:
      'Widget catalog, marine abbreviations, units, precision, colour/zones, copy style, and a common-anti-patterns scan.',
    mimeType: 'text/markdown',
  },
];

/**
 * The KIP MCP server: exposes the design-vocabulary tools and resources over MCP.
 * The heavy logic lives in tested modules (tools, vocabulary, schema); this class
 * is the thin wiring to the Model Context Protocol. It uses the high-level
 * `McpServer` API so each tool carries a zod input schema, an output schema and
 * behaviour annotations, and every call returns structured content.
 */
export class KipMCPServer {
  private readonly server: McpServer;
  private readonly loadSchemaFn: () => Promise<SchemaResult>;
  private readonly sk: SkClient;
  private readonly appData: SkAppDataClient;
  private readonly config: ServerConfig;
  private schema?: KipDashboardSchema;

  constructor(options: KipMCPServerOptions = {}) {
    const config = loadConfig();
    this.config = config;
    this.schema = options.schema;
    this.loadSchemaFn = options.loadSchema ?? (() => loadKipSchema({ baseUrl: config.kipBaseUrl }));
    // One token source, shared by the read and write clients: a username/password
    // login runs once per token lifetime and is re-authenticated on demand when a
    // request is rejected (401/403).
    const tokens = new TokenProvider({
      baseUrl: config.signalkBaseUrl,
      token: config.token,
      credentials: config.credentials,
    });
    const getToken = (opts?: { forceRefresh?: boolean }) => tokens.get(opts);
    this.sk = options.sk ?? new SkClient({ baseUrl: config.signalkBaseUrl, getToken });
    this.appData =
      options.appData ?? new SkAppDataClient({ baseUrl: config.signalkBaseUrl, getToken });
    this.server = new McpServer(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { logging: {} } },
    );
    this.registerTools();
    this.registerResources();
    this.registerPrompts();
  }

  private async getSchema(): Promise<KipDashboardSchema> {
    if (!this.schema) {
      const result = await this.loadSchemaFn();
      this.schema = result.schema;
      if (result.warning) {
        await this.log('warning', result.warning);
      }
    }
    return this.schema;
  }

  /**
   * Sends a log message to the connected client, falling back to stderr when the
   * server is not connected or the client cannot receive it.
   */
  private async log(level: 'warning' | 'error' | 'info', data: string): Promise<void> {
    if (this.server.isConnected()) {
      try {
        await this.server.sendLoggingMessage({ level, logger: SERVER_NAME, data });
        return;
      } catch {
        // Fall through to stderr below.
      }
    }
    console.error(`[${SERVER_NAME}] ${level}: ${data}`);
  }

  private registerTools(): void {
    const groups: Array<{
      specs: ToolSpec[];
      run: (
        name: string,
        args: Record<string, unknown>,
        ctx?: ToolCtx,
      ) => unknown | Promise<unknown>;
    }> = [
      {
        specs: VOCAB_TOOL_SPECS,
        run: async (name, args) => callTool(await this.getSchema(), name, args),
      },
      {
        specs: DISCOVERY_TOOL_SPECS,
        run: (name, args, ctx) => callDiscoveryTool(this.sk, name, args, ctx),
      },
      {
        specs: COMPOSE_TOOL_SPECS,
        run: async (name, args, ctx) =>
          callComposeTool(await this.getSchema(), this.sk, name, args, ctx),
      },
      {
        specs: WRITE_TOOL_SPECS,
        run: async (name, args, ctx) =>
          callWriteTool(await this.getSchema(), this.appData, this.sk, name, args, ctx),
      },
      {
        specs: DOCTOR_TOOL_SPECS,
        run: (name) =>
          callDoctorTool(
            { config: this.config, sk: this.sk, loadSchema: () => this.loadSchemaFn() },
            name,
          ),
      },
    ];

    for (const group of groups) {
      for (const spec of group.specs) {
        this.server.registerTool(
          spec.name,
          {
            title: spec.title,
            description: spec.description,
            inputSchema: spec.inputSchema,
            outputSchema: spec.outputSchema,
            annotations: spec.annotations,
          },
          async (args, extra) =>
            toToolResult(
              await group.run(spec.name, (args ?? {}) as Record<string, unknown>, {
                server: this.server.server,
                extra,
              }),
            ),
        );
      }
    }
  }

  private registerResources(): void {
    for (const resource of RESOURCES) {
      this.server.registerResource(
        resource.name,
        resource.uri,
        { description: resource.description, mimeType: resource.mimeType },
        async () => {
          const schema = await this.getSchema();
          const text = this.readResource(resource.uri, schema);
          return { contents: [{ uri: resource.uri, mimeType: resource.mimeType, text }] };
        },
      );
    }

    // Each widget addressable on its own, with selector completion.
    this.server.registerResource(
      'KIP widget',
      new ResourceTemplate('kip://widget/{selector}', {
        // These run during resources/list and completion. If the schema can't be
        // loaded (e.g. a remote KIP rejects auth), degrade to empty rather than
        // failing the whole listing — reading a widget still surfaces the error.
        list: async () => {
          try {
            return { resources: listWidgetResources(await this.getSchema()) };
          } catch {
            return { resources: [] };
          }
        },
        complete: {
          selector: async (value) => {
            try {
              return completeWidgetSelector(await this.getSchema(), value);
            } catch {
              return [];
            }
          },
        },
      }),
      {
        description: 'One KIP widget by selector, with its default config, binding kind and slots.',
        mimeType: 'application/json',
      },
      async (uri, variables) => {
        const text = readWidgetResource(await this.getSchema(), String(variables.selector));
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text }] };
      },
    );

    // Each dashboard template addressable on its own, with id completion.
    this.server.registerResource(
      'KIP dashboard template',
      new ResourceTemplate('kip://template/{id}', {
        list: () => ({ resources: listTemplateResources() }),
        complete: { id: (value) => completeTemplateId(value) },
      }),
      {
        description: 'One KIP dashboard template by id, with the widgets it lays out.',
        mimeType: 'application/json',
      },
      async (uri, variables) => {
        const text = readTemplateResource(String(variables.id));
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text }] };
      },
    );
  }

  private registerPrompts(): void {
    for (const spec of PROMPT_SPECS) {
      this.server.registerPrompt(
        spec.name,
        { title: spec.title, description: spec.description, argsSchema: spec.argsSchema },
        (args) => spec.build(args as Record<string, string | undefined>),
      );
    }
  }

  private readResource(uri: string, schema: KipDashboardSchema): string {
    switch (uri) {
      case 'kip://widget_catalog':
        return JSON.stringify(schema.widgets, null, 2);
      case 'kip://design_system':
        return JSON.stringify(schema.designSystem, null, 2);
      case 'kip://initial_context':
        return readResourceText('kip-initial-context.md');
      case 'kip://ux-review-guide':
        return readResourceText('ux/review-guide.md');
      case 'kip://ux-laws':
        return readResourceText('ux/ux-laws.md');
      case 'kip://ux-conventions':
        return readResourceText('ux/kip-conventions.md');
      default:
        throw new Error(`Unknown resource "${uri}".`);
    }
  }

  /** Connects the server to a transport (used by tests with an in-memory transport). */
  async connect(transport: Parameters<McpServer['connect']>[0]): Promise<void> {
    await this.server.connect(transport);
  }

  /** Runs the server over stdio. */
  async run(): Promise<void> {
    await this.connect(new StdioServerTransport());
  }
}
