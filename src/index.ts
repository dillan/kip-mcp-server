#!/usr/bin/env node
/**
 * kip-mcp-server entry point (stdio transport).
 */
import * as dotenv from 'dotenv';
import { KipMCPServer } from './kip-mcp-server.js';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('[kip-mcp-server] Unhandled rejection:', reason);
});

const server = new KipMCPServer();
server.run().catch((error: unknown) => {
  console.error('[kip-mcp-server] Failed to start:', error);
  process.exit(1);
});
