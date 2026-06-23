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
  const result = await client.callTool({ name: 'get_kip_initial_context', arguments: {} });
  const text = result.content?.[0]?.text ?? '';
  if (!text.includes('KIP')) {
    throw new Error('get_kip_initial_context did not return the expected overview');
  }
  await client.close();
  console.log(`SMOKE OK — ${names.length} tools: ${names.join(', ')}`);
  process.exit(0);
} catch (error) {
  console.error('SMOKE FAILED:', error);
  process.exit(1);
}
