import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  ElicitRequestSchema,
  LoggingMessageNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SkClient } from './discovery/sk-client.js';
import { KipMCPServer, type KipMCPServerOptions } from './kip-mcp-server.js';
import { loadBundledSchema } from './schema/kip-schema.js';
import { SkAppDataClient } from './write/appdata-client.js';

async function connectWith(
  options: KipMCPServerOptions = {},
  client: Client = new Client({ name: 'test-client', version: '0.0.0' }),
): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new KipMCPServer({ schema: loadBundledSchema(), ...options });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** A fake applicationData fetch: GET (read existing) -> 404; POST/PATCH -> 200. Records methods. */
const recordingAppFetch = (methods: string[]): typeof fetch =>
  (async (_url: unknown, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    methods.push(method);
    return new Response(JSON.stringify(null), { status: method === 'GET' ? 404 : 200 });
  }) as unknown as typeof fetch;

const skVersion = (version: string): SkClient =>
  new SkClient({ baseUrl: 'http://boat:3000', fetchImpl: jsonFetch({ server: { version } }) });

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

describe('resource templates and completion', () => {
  it('exposes the widget and template resource templates', async () => {
    const client = await connectClient();
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate)).toEqual(
      expect.arrayContaining(['kip://widget/{selector}', 'kip://template/{id}']),
    );
    await client.close();
  });

  it('reads an individual widget via its template URI', async () => {
    const client = await connectClient();
    const read = await client.readResource({ uri: 'kip://widget/widget-numeric' });
    const contents = read.contents as Array<{ uri: string; text: string }>;
    expect(contents[0].uri).toBe('kip://widget/widget-numeric');
    expect(JSON.parse(contents[0].text).selector).toBe('widget-numeric');
    await client.close();
  });

  it('reads an individual dashboard template via its template URI', async () => {
    const client = await connectClient();
    const read = await client.readResource({ uri: 'kip://template/sailing' });
    const contents = read.contents as Array<{ text: string }>;
    expect(JSON.parse(contents[0].text).id).toBe('sailing');
    await client.close();
  });

  it('completes a widget selector template variable', async () => {
    const client = await connectClient();
    const res = await client.complete({
      ref: { type: 'ref/resource', uri: 'kip://widget/{selector}' },
      argument: { name: 'selector', value: 'widget-g' },
    });
    expect(res.completion.values.length).toBeGreaterThan(0);
    expect(res.completion.values.every((v) => v.startsWith('widget-g'))).toBe(true);
    await client.close();
  });

  it('completes the optional design_dashboards focus argument', async () => {
    const client = await connectClient();
    const res = await client.complete({
      ref: { type: 'ref/prompt', name: 'design_dashboards' },
      argument: { name: 'focus', value: 'sa' },
    });
    expect(res.completion.values).toContain('sailing');
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

describe('logging', () => {
  it('advertises the logging capability and sends the schema-fallback warning', async () => {
    const logs: Array<{ level: string; logger?: string; data: unknown }> = [];
    const client = new Client({ name: 'log-client', version: '0.0.0' });
    client.setNotificationHandler(LoggingMessageNotificationSchema, (n) => {
      logs.push(n.params);
    });
    const connected = await connectWith(
      {
        schema: undefined,
        loadSchema: async () => ({
          schema: loadBundledSchema(),
          source: 'bundled' as const,
          warning: 'Using the bundled schema generated for KIP 4.8.0',
        }),
      },
      client,
    );
    expect(connected.getServerCapabilities()?.logging).toBeDefined();
    await connected.callTool({ name: 'list_kip_widgets', arguments: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logs.some((l) => l.level === 'warning' && String(l.data).includes('bundled'))).toBe(
      true,
    );
    await connected.close();
  });
});

describe('elicitation for apply_kip_config', () => {
  function elicitingClient(reply: {
    action: 'accept' | 'decline' | 'cancel';
    content?: Record<string, unknown>;
  }): {
    client: Client;
    seen: { requestedSchema?: Record<string, unknown>; message?: string };
  } {
    const seen: { requestedSchema?: Record<string, unknown>; message?: string } = {};
    const client = new Client(
      { name: 'elicit-client', version: '0.0.0' },
      { capabilities: { elicitation: { form: {} } } },
    );
    client.setRequestHandler(ElicitRequestSchema, (req) => {
      if ('requestedSchema' in req.params) {
        seen.requestedSchema = req.params.requestedSchema as Record<string, unknown>;
      }
      seen.message = req.params.message;
      return reply;
    });
    return { client, seen };
  }

  it('writes when the user accepts the confirmation', async () => {
    const methods: string[] = [];
    const appData = new SkAppDataClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: recordingAppFetch(methods),
    });
    const { client, seen } = elicitingClient({ action: 'accept', content: { confirm: true } });
    const connected = await connectWith({ sk: skVersion('2.13.0'), appData }, client);
    const result = await connected.callTool({
      name: 'apply_kip_config',
      arguments: { dashboards: [sampleDashboard], dryRun: false },
    });
    expect((result.structuredContent as { applied?: boolean }).applied).toBe(true);
    const props = seen.requestedSchema?.properties as { confirm?: { type?: string } } | undefined;
    expect(props?.confirm?.type).toBe('boolean');
    expect(methods).toContain('POST');
    await connected.close();
  });

  it('stays a dry run when the user declines', async () => {
    const methods: string[] = [];
    const appData = new SkAppDataClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: recordingAppFetch(methods),
    });
    const { client } = elicitingClient({ action: 'decline' });
    const connected = await connectWith({ sk: skVersion('2.13.0'), appData }, client);
    const result = await connected.callTool({
      name: 'apply_kip_config',
      arguments: { dashboards: [sampleDashboard], dryRun: false },
    });
    expect((result.structuredContent as { dryRun?: boolean }).dryRun).toBe(true);
    expect(methods).not.toContain('POST');
    await connected.close();
  });

  it('falls back to a dry run (no throw) when the client cannot elicit', async () => {
    const methods: string[] = [];
    const appData = new SkAppDataClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: recordingAppFetch(methods),
    });
    const connected = await connectWith({ sk: skVersion('2.13.0'), appData });
    const result = await connected.callTool({
      name: 'apply_kip_config',
      arguments: { dashboards: [sampleDashboard], dryRun: false },
    });
    expect((result.structuredContent as { dryRun?: boolean }).dryRun).toBe(true);
    expect(methods).not.toContain('POST');
    await connected.close();
  });

  it('stays a dry run when the user accepts the form but answers no', async () => {
    const methods: string[] = [];
    const appData = new SkAppDataClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: recordingAppFetch(methods),
    });
    const { client } = elicitingClient({ action: 'accept', content: { confirm: false } });
    const connected = await connectWith({ sk: skVersion('2.13.0'), appData }, client);
    const result = await connected.callTool({
      name: 'apply_kip_config',
      arguments: { dashboards: [sampleDashboard], dryRun: false },
    });
    expect((result.structuredContent as { dryRun?: boolean }).dryRun).toBe(true);
    expect(methods).not.toContain('POST');
    await connected.close();
  });

  it('degrades to a dry run (no error) when elicitation fails on the client', async () => {
    const methods: string[] = [];
    const appData = new SkAppDataClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: recordingAppFetch(methods),
    });
    // Declares form support but registers no elicitation handler, so the request rejects.
    const client = new Client(
      { name: 'broken-elicit-client', version: '0.0.0' },
      { capabilities: { elicitation: { form: {} } } },
    );
    const connected = await connectWith({ sk: skVersion('2.13.0'), appData }, client);
    const result = await connected.callTool({
      name: 'apply_kip_config',
      arguments: { dashboards: [sampleDashboard], dryRun: false },
    });
    expect((result.structuredContent as { dryRun?: boolean }).dryRun).toBe(true);
    expect(result.isError).toBeFalsy();
    expect(methods).not.toContain('POST');
    await connected.close();
  });
});

describe('progress notifications', () => {
  const lastIsComplete = (events: Array<{ progress: number; total?: number }>): boolean => {
    const last = events[events.length - 1];
    return events.length >= 2 && events[0].progress === 0 && last.progress === last.total;
  };

  it('apply_kip_config reports progress when a progressToken is supplied', async () => {
    const appData = new SkAppDataClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: recordingAppFetch([]),
    });
    const connected = await connectWith({ sk: skVersion('2.13.0'), appData });
    const events: Array<{ progress: number; total?: number }> = [];
    await connected.callTool(
      { name: 'apply_kip_config', arguments: { dashboards: [sampleDashboard] } },
      undefined,
      { onprogress: (p) => events.push(p) },
    );
    expect(lastIsComplete(events)).toBe(true);
    await connected.close();
  });

  it('analyze_signalk_data reports progress', async () => {
    const sk = new SkClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: jsonFetch({ server: { version: '2.13.0' }, self: {}, vessels: {} }),
    });
    const connected = await connectWith({ sk });
    const events: Array<{ progress: number; total?: number }> = [];
    await connected.callTool({ name: 'analyze_signalk_data', arguments: {} }, undefined, {
      onprogress: (p) => events.push(p),
    });
    expect(lastIsComplete(events)).toBe(true);
    await connected.close();
  });

  it('recommend_dashboard_set reports progress', async () => {
    const connected = await connectWith({ sk: skVersion('2.13.0') });
    const events: Array<{ progress: number; total?: number }> = [];
    await connected.callTool({ name: 'recommend_dashboard_set', arguments: {} }, undefined, {
      onprogress: (p) => events.push(p),
    });
    expect(lastIsComplete(events)).toBe(true);
    await connected.close();
  });

  it('reports the apply write-path sequence 0 -> 2 -> 3 when it actually writes', async () => {
    const methods: string[] = [];
    const appData = new SkAppDataClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: recordingAppFetch(methods),
    });
    const connected = await connectWith({ sk: skVersion('2.13.0'), appData });
    const events: Array<{ progress: number; total?: number }> = [];
    // confirm:true skips elicitation and takes the write branch.
    await connected.callTool(
      {
        name: 'apply_kip_config',
        arguments: { dashboards: [sampleDashboard], dryRun: false, confirm: true },
      },
      undefined,
      { onprogress: (p) => events.push(p) },
    );
    expect(events.map((e) => e.progress)).toEqual([0, 2, 3]);
    expect(events.every((e) => e.total === 3)).toBe(true);
    expect(methods).toContain('POST');
    await connected.close();
  });

  it('emits no progress and does not error when no progressToken is supplied', async () => {
    const appData = new SkAppDataClient({
      baseUrl: 'http://boat:3000',
      fetchImpl: recordingAppFetch([]),
    });
    const connected = await connectWith({ sk: skVersion('2.13.0'), appData });
    const result = await connected.callTool({
      name: 'apply_kip_config',
      arguments: { dashboards: [sampleDashboard] },
    });
    expect((result.structuredContent as { dryRun?: boolean }).dryRun).toBe(true);
    await connected.close();
  });
});

describe('live validation and diagnostics (in-memory)', () => {
  const vesselFetch = (async (url: unknown) => {
    const u = String(url);
    if (u.includes('/vessels/self')) {
      return new Response(
        JSON.stringify({ navigation: { speedOverGround: { value: 5, meta: { units: 'm/s' } } } }),
        { status: 200 },
      );
    }
    if (u.includes('/skServer/plugins')) return new Response(JSON.stringify([]), { status: 200 });
    return new Response(JSON.stringify({ server: { version: '2.13.0' } }), { status: 200 });
  }) as unknown as typeof fetch;

  it('validate_against_signalk confirms a dashboard whose paths the boat reports', async () => {
    const sk = new SkClient({ baseUrl: 'http://boat:3000', fetchImpl: vesselFetch });
    const connected = await connectWith({ sk });
    const dashboard = {
      id: 'd1',
      name: 'T',
      icon: 'dashboard-dashboard',
      configuration: [
        {
          w: 2,
          h: 2,
          x: 0,
          y: 0,
          id: 'u1',
          selector: 'widget-host2',
          input: {
            widgetProperties: {
              type: 'widget-numeric',
              uuid: 'u1',
              config: { paths: { numericPath: { path: 'self.navigation.speedOverGround' } } },
            },
          },
        },
      ],
    };
    const result = await connected.callTool({
      name: 'validate_against_signalk',
      arguments: { dashboard },
    });
    const structured = result.structuredContent as { ok?: boolean; checkedPaths?: number };
    expect(structured.ok).toBe(true);
    expect(structured.checkedPaths).toBe(1);
    await connected.close();
  });

  it('validate_against_signalk reports problems (ok:false) through the client output schema', async () => {
    const sk = new SkClient({ baseUrl: 'http://boat:3000', fetchImpl: vesselFetch });
    const connected = await connectWith({ sk });
    const dashboard = {
      id: 'd1',
      name: 'T',
      icon: 'dashboard-dashboard',
      configuration: [
        {
          w: 2,
          h: 2,
          x: 0,
          y: 0,
          id: 'u1',
          selector: 'widget-host2',
          input: {
            widgetProperties: {
              type: 'widget-numeric',
              uuid: 'u1',
              // A path the boat does not report.
              config: { paths: { numericPath: { path: 'self.navigation.courseOverGroundTrue' } } },
            },
          },
        },
      ],
    };
    const result = await connected.callTool({
      name: 'validate_against_signalk',
      arguments: { dashboard },
    });
    const structured = result.structuredContent as { ok?: boolean; missingPaths?: unknown[] };
    expect(result.isError).toBeFalsy();
    expect(structured.ok).toBe(false);
    expect(structured.missingPaths?.length).toBeGreaterThan(0);
    await connected.close();
  });

  it('check_connection reports the connection checks', async () => {
    const connected = await connectWith({
      sk: skVersion('2.13.0'),
      loadSchema: async () => ({ schema: loadBundledSchema(), source: 'remote' as const }),
    });
    const result = await connected.callTool({ name: 'check_connection', arguments: {} });
    const structured = result.structuredContent as { ok?: boolean; checks?: { id: string }[] };
    expect(structured.checks?.map((c) => c.id)).toEqual(
      expect.arrayContaining(['signalk_reachable', 'kip_schema_served', 'auth_ok']),
    );
    expect(structured.ok).toBe(true);
    await connected.close();
  });
});
