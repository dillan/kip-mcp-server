/**
 * Helpers for argument completion on OPTIONAL prompt arguments.
 *
 * Why this exists: the MCP SDK enables the completions capability for a prompt
 * argument by unwrapping a `ZodOptional` to look for a completable inner type
 * (server/mcp.js `_createRegisteredPrompt`), but its completion *handler*
 * (`handlePromptCompletion`) checks the argument field DIRECTLY with
 * `isCompletable(field)`. So the obvious `completable(z.string(), cb).optional()`
 * gets the capability advertised yet returns no suggestions, because the outer
 * `ZodOptional` carries no completion metadata.
 *
 * `optionalCompletable` attaches the metadata to BOTH the inner string and the
 * outer `ZodOptional`, so both SDK code paths see it. The integration test in
 * kip-mcp-server.spec.ts ("completes the optional design_dashboards focus
 * argument") guards this against a future SDK change.
 */
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { z } from 'zod';

export type CompleteFn = (value: string) => string[] | Promise<string[]>;

/** A completion callback suggesting options that start with the typed value (case-insensitive). */
export function prefixComplete(options: readonly string[]): CompleteFn {
  return (value: string) => {
    const v = value.toLowerCase();
    return options.filter((o) => o.toLowerCase().startsWith(v));
  };
}

/** Makes an optional string prompt argument completable (see the file header). */
export function optionalCompletable(description: string, complete: CompleteFn): z.ZodTypeAny {
  const inner = completable(z.string().describe(description), complete);
  return completable(inner.optional(), (value) => complete(typeof value === 'string' ? value : ''));
}
