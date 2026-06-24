#!/usr/bin/env node
/**
 * kip-mcp-server entry point. Runs the MCP server over stdio, or connection
 * diagnostics when invoked with `--doctor`.
 */
import * as dotenv from 'dotenv';
import { describeConfig, loadConfig } from './config.js';
import { SkClient } from './discovery/sk-client.js';
import { formatDoctorReport, runDoctor } from './doctor.js';
import { KipMCPServer } from './kip-mcp-server.js';
import { loadKipSchema } from './schema/kip-schema.js';
import { TokenProvider } from './signalk/auth.js';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('[kip-mcp-server] Unhandled rejection:', reason);
});

/** Prints a clear message and exits — used for config errors and startup failures. */
function fail(error: unknown): never {
  console.error(`[kip-mcp-server] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (process.argv.slice(2).includes('--doctor')) {
  try {
    const config = loadConfig();
    const tokens = new TokenProvider({
      baseUrl: config.signalkBaseUrl,
      token: config.token,
      credentials: config.credentials,
    });
    const sk = new SkClient({
      baseUrl: config.signalkBaseUrl,
      getToken: (opts?: { forceRefresh?: boolean }) => tokens.get(opts),
    });
    runDoctor({ config, sk, loadSchema: () => loadKipSchema({ baseUrl: config.kipBaseUrl }) })
      .then((report) => {
        console.log(formatDoctorReport(report));
        process.exit(report.ok ? 0 : 1);
      })
      .catch(fail);
  } catch (error) {
    fail(error);
  }
} else {
  try {
    const config = loadConfig();
    console.error(`[kip-mcp-server] ${describeConfig(config)}`);
    new KipMCPServer().run().catch(fail);
  } catch (error) {
    fail(error);
  }
}
