#!/usr/bin/env node
/**
 * kip-mcp-server entry point (stdio transport).
 *
 * The full MCP server is wired up in a later phase. For now this is a stub so the
 * package builds and the `kip-mcp-server` bin is linkable.
 */
import { serverName } from './health.js';

console.error(`${serverName()} starting (bootstrap build)`);
