import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { KipMCPServer } from './kip-mcp-server.js';
import { loadBundledSchema } from './schema/kip-schema.js';

async function connectClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new KipMCPServer({ schema: loadBundledSchema() });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

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
