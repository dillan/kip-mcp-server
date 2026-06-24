// Built-artifact smoke test: spawn the compiled stdio server and exercise it over
// MCP, exactly as a real client (Claude Desktop, Codex, ...) would.
import { spawn, spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// stdout carries ONLY JSON-RPC for a stdio server. Anything else (a banner, a
// log line, dotenv's "injected env" tip) corrupts the stream and breaks clients.
// Start the server, send nothing, and assert it stays silent on stdout.
async function assertSilentStdout() {
  const child = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (chunk) => {
    out += chunk.toString();
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  child.kill();
  if (out.trim() !== '') {
    throw new Error(
      `server wrote non-protocol output to stdout at startup: ${JSON.stringify(out.slice(0, 200))}`,
    );
  }
}

const transport = new StdioClientTransport({ command: 'node', args: ['dist/index.js'] });
const client = new Client({ name: 'smoke', version: '0.0.0' });

try {
  await assertSilentStdout();
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

  // The --doctor CLI runs diagnostics and exits without starting the stdio server.
  const doctor = spawnSync('node', ['dist/index.js', '--doctor'], {
    encoding: 'utf8',
    timeout: 30000,
  });
  const doctorOut = `${doctor.stdout ?? ''}${doctor.stderr ?? ''}`;
  if (!doctorOut.includes('Signal K server reachable')) {
    throw new Error(`--doctor did not print the connection checks. Output:\n${doctorOut}`);
  }

  console.log(
    `SMOKE OK — ${names.length} tools, ${prompts.length} prompts, --doctor runs: ${names.join(', ')}`,
  );
  process.exit(0);
} catch (error) {
  console.error('SMOKE FAILED:', error);
  process.exit(1);
}
