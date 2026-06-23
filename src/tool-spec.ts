/**
 * Shared shape for an MCP tool registration.
 *
 * Each tool carries zod input and output schemas (the single source of truth —
 * the SDK converts them to JSON Schema), a human-friendly title, and behaviour
 * hints (annotations) that clients use to decide how to surface the tool.
 *
 * KIP domain objects (widgets, dashboards, configs, path metadata) are typed
 * loosely in the output schemas on purpose: their authoritative schema is the
 * KIP dashboard JSON Schema, so we describe a result's top-level shape without
 * trying to restate that whole schema in zod. Keys that are only present in some
 * results are marked `.optional()` so output validation never fails by surprise.
 */
import { z } from 'zod';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';

export interface ToolSpec {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  outputSchema: z.ZodRawShape;
  annotations: ToolAnnotations;
}

/** A KIP domain object whose detailed shape is defined by the KIP schema. */
export const kipObject = z.record(z.string(), z.unknown());

/** Read-only and works without any external server (pure schema/vocabulary). */
export const READ_ONLY_LOCAL: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };

/** Read-only, but reads from the live Signal K server. */
export const READ_ONLY_REMOTE: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };

/** Writes to the live Signal K server and can overwrite existing dashboards. */
export const WRITE_REMOTE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
  // The SDK's CallToolResult carries an index signature (for _meta etc.).
  [key: string]: unknown;
}

/**
 * Wraps a tool's object result as an MCP tool result: a JSON text block (for
 * clients that do not read structured content) plus the same object as
 * machine-readable `structuredContent`.
 */
export function toToolResult(result: unknown): ToolResult {
  const value = (result ?? {}) as Record<string, unknown>;
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

/**
 * Per-call context passed to the tool dispatchers: the low-level server (for
 * elicitation) and the request `extra` (for progress and cancellation).
 */
export interface ToolCtx {
  server: Server;
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>;
}

/** Reports progress on a multi-step tool. A no-op unless the caller sent a progressToken. */
export type ProgressReporter = (progress: number, total: number, message?: string) => Promise<void>;

/**
 * Builds a progress reporter for a tool call. If the caller did not supply a
 * progressToken (via request `_meta`), the reporter is a no-op, so progress is
 * only emitted when someone is listening.
 */
export function makeProgressReporter(ctx?: ToolCtx): ProgressReporter {
  const token = ctx?.extra._meta?.progressToken;
  if (token === undefined) {
    return () => Promise.resolve();
  }
  return (progress, total, message) =>
    ctx!.extra.sendNotification({
      method: 'notifications/progress',
      params: { progressToken: token, progress, total, ...(message ? { message } : {}) },
    });
}
