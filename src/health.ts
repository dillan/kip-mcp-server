/**
 * Minimal identity/health helpers.
 *
 * These exist so the build, type-checker, and test harness have something real to
 * exercise during project bootstrap. They are replaced by the actual MCP server
 * wiring in a later phase.
 */

export const SERVER_NAME = 'kip-mcp-server';

export interface Health {
  ok: true;
  name: string;
}

/** Returns the server's package name. */
export function serverName(): string {
  return SERVER_NAME;
}

/** Returns a simple health object used to confirm the toolchain works end to end. */
export function health(): Health {
  return { ok: true, name: SERVER_NAME };
}
