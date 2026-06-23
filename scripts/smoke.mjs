// Built-artifact smoke test: spawn the compiled stdio server and exercise it over
// MCP, exactly as a real client (Claude Desktop, Codex, ...) would.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({ command: 'node', args: ['dist/index.js'] });
const client = new Client({ name: 'smoke', version: '0.0.0' });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  if (!names.includes('list_kip_widgets')) {
    throw new Error(`expected list_kip_widgets, got: ${names.join(', ')}`);
  }
  // World-class surface: tools advertise output schemas and behaviour hints.
  const widgets = tools.find((t) => t.name === 'list_kip_widgets');
  if (!widgets?.outputSchema || widgets.annotations?.readOnlyHint !== true) {
    throw new Error('list_kip_widgets is missing its output schema or read-only annotation');
  }
  const result = await client.callTool({ name: 'get_kip_initial_context', arguments: {} });
  const text = result.content?.[0]?.text ?? '';
  if (!text.includes('KIP')) {
    throw new Error('get_kip_initial_context did not return the expected overview');
  }
  // Calls return machine-readable structured content next to the text block.
  if (typeof result.structuredContent?.overview !== 'string') {
    throw new Error('get_kip_initial_context did not return structured content');
  }
  // Guided prompts are exposed for one-click workflows.
  const { prompts } = await client.listPrompts();
  if (!prompts.some((p) => p.name === 'design_dashboards')) {
    throw new Error('expected the design_dashboards prompt to be listed');
  }
  await client.close();
  console.log(`SMOKE OK — ${names.length} tools, ${prompts.length} prompts: ${names.join(', ')}`);
  process.exit(0);
} catch (error) {
  console.error('SMOKE FAILED:', error);
  process.exit(1);
}
