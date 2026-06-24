#!/usr/bin/env node
/**
 * kip-mcp-server entry point. Runs the MCP server over stdio, or connection
 * diagnostics when invoked with `--doctor`.
 */
import * as dotenv from 'dotenv';
import { loadConfig } from './config.js';
import { SkClient } from './discovery/sk-client.js';
import { formatDoctorReport, runDoctor } from './doctor.js';
import { KipMCPServer } from './kip-mcp-server.js';
import { loadKipSchema } from './schema/kip-schema.js';
import { TokenProvider } from './signalk/auth.js';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('[kip-mcp-server] Unhandled rejection:', reason);
});

if (process.argv.slice(2).includes('--doctor')) {
  const config = loadConfig();
  const tokens = new TokenProvider({
    baseUrl: config.signalkBaseUrl,
    token: config.token,
    credentials: config.credentials,
  });
  const sk = new SkClient({ baseUrl: config.signalkBaseUrl, getToken: () => tokens.get() });
  runDoctor({ config, sk, loadSchema: () => loadKipSchema({ baseUrl: config.kipBaseUrl }) })
    .then((report) => {
      console.log(formatDoctorReport(report));
      process.exit(report.ok ? 0 : 1);
    })
    .catch((error: unknown) => {
      console.error('[kip-mcp-server] Doctor failed:', error);
      process.exit(1);
    });
} else {
  const server = new KipMCPServer();
  server.run().catch((error: unknown) => {
    console.error('[kip-mcp-server] Failed to start:', error);
    process.exit(1);
  });
}
