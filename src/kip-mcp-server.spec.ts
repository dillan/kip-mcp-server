import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SkClient } from './discovery/sk-client.js';
import { KipMCPServer, type KipMCPServerOptions } from './kip-mcp-server.js';
import { loadBundledSchema } from './schema/kip-schema.js';
import { SkAppDataClient } from './write/appdata-client.js';

async function connectWith(options: Omit<KipMCPServerOptions, 'schema'> = {}): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new KipMCPServer({ schema: loadBundledSchema(), ...options });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const connectClient = (): Promise<Client> => connectWith();

/** A fake fetch that always returns the given JSON body with HTTP 200. */
const jsonFetch = (body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

const sampleDashboard = {
  id: 'd1',
  name: 'X',
  icon: 'dashboard-dashboard',
  collapseSplitShell: false,
  configuration: [],
};

describe('KipMCPServer over MCP (in-memory)', () => {
  it('lists the vocabulary tools', async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['get_kip_initial_context', 'list_kip_widgets', 'get_widget_schema']),
    );
    await client.close();
  });

  it('calls list_kip_widgets and returns the catalog as JSON text', async () => {
    const client = await connectClient();
    const result = await client.callTool({ name: 'list_kip_widgets', arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    const payload = JSON.parse(content[0].text) as { widgets: unknown[] };
    expect(payload.widgets.length).toBeGreaterThanOrEqual(30);
    await client.close();
  });

  it('reports an error for an unknown widget selector', async () => {
    const client = await connectClient();
    const result = await client.callTool({
      name: 'get_widget_schema',
      arguments: { selector: 'widget-nope' },
    });
    expect(result.isError).toBe(true);
    await client.close();
  });

  it('lists and reads resources', async () => {
    const client = await connectClient();
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(
      expect.arrayContaining(['kip://widget_catalog', 'kip://initial_context']),
    );
    const read = await client.readResource({ uri: 'kip://initial_context' });
    const contents = read.contents as Array<{ text: string }>;
    expect(contents[0].text).toContain('KIP');
    await client.close();
  });
});

describe('world-class MCP surface (structured output + annotations)', () => {
  it('exposes output schemas and read-only annotations on tools', async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const widgets = tools.find((t) => t.name === 'list_kip_widgets');
    expect(widgets?.annotations?.readOnlyHint).toBe(true);
    expect(widgets?.outputSchema).toBeDefined();
    await client.close();
  });

  it('returns machine-readable structuredContent alongside the JSON text', async () => {
    const client = await connectClient();
    const result = await client.callTool({ name: 'list_kip_widgets', arguments: {} });
    const structured = result.structuredContent as { widgets?: unknown[] } | undefined;
    expect(structured?.widgets?.length).toBeGreaterThanOrEqual(30);
    // The text block stays for clients that do not read structured content.
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toHaveProperty('widgets');
    await client.close();
  });
});

describe('structured output across tool groups (the client validates each output schema)', () => {
  it('discovery: get_server_info returns structured content', async () => {
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: jsonFetch({ server: { version: '2.13.0', id: 'abc' } }),
    });
    const client = await connectWith({ sk });
    const result = await client.callTool({ name: 'get_server_info', arguments: {} });
    expect((result.structuredContent as { version?: string }).version).toBe('2.13.0');
    await client.close();
  });

  it('compose: preview_dashboard returns structured content', async () => {
    const client = await connectClient();
    const result = await client.callTool({
      name: 'preview_dashboard',
      arguments: { dashboard: sampleDashboard },
    });
    expect(typeof (result.structuredContent as { ascii?: string }).ascii).toBe('string');
    await client.close();
  });

  it('write: apply_kip_config dry-runs and writes nothing', async () => {
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: jsonFetch({ server: { version: '2.13.0' } }),
    });
    const methods: string[] = [];
    const appFetch = (async (_url: unknown, init?: { method?: string }) => {
      methods.push(init?.method ?? 'GET');
      return new Response(JSON.stringify(null), { status: 404 });
    }) as unknown as typeof fetch;
    const appData = new SkAppDataClient({ baseUrl: 'http://boat:3000', fetchImpl: appFetch });
    const client = await connectWith({ sk, appData });
    const result = await client.callTool({
      name: 'apply_kip_config',
      arguments: { dashboards: [sampleDashboard] },
    });
    expect((result.structuredContent as { dryRun?: boolean }).dryRun).toBe(true);
    expect(methods).not.toContain('POST');
    await client.close();
  });
});

describe('guided prompts', () => {
  it('lists the design and review prompts', async () => {
    const client = await connectClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(
      expect.arrayContaining(['design_dashboards', 'review_dashboard']),
    );
    await client.close();
  });

  it('builds the design_dashboards prompt and honours the focus argument', async () => {
    const client = await connectClient();
    const result = await client.getPrompt({
      name: 'design_dashboards',
      arguments: { focus: 'sailing' },
    });
    const text = (result.messages[0].content as { text: string }).text;
    expect(text).toContain('analyze_signalk_data');
    expect(text).toContain('sailing');
    await client.close();
  });
});
