/**
 * Backing logic for the templated resources `kip://widget/{selector}` and
 * `kip://template/{id}`. Each widget and dashboard template is exposed as an
 * individually addressable, browsable resource (with URI-variable completion),
 * instead of only living inside the `kip://widget_catalog` blob.
 *
 * These are pure functions so they can be unit-tested without an MCP server;
 * the thin SDK wiring lives in kip-mcp-server.ts.
 */
import { TEMPLATES } from './compose/templates.js';
import type { KipDashboardSchema } from './schema/schema-types.js';

const JSON_MIME = 'application/json';

export interface ResourceListing {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/** Lists every widget as an individual `kip://widget/{selector}` resource. */
export function listWidgetResources(schema: KipDashboardSchema): ResourceListing[] {
  return schema.widgets.map((w) => ({
    uri: `kip://widget/${w.selector}`,
    name: w.name,
    description: w.description,
    mimeType: JSON_MIME,
  }));
}

/** Suggests widget selectors that start with the partial value (case-insensitive). */
export function completeWidgetSelector(schema: KipDashboardSchema, value: string): string[] {
  const v = value.toLowerCase();
  return schema.widgets.map((w) => w.selector).filter((s) => s.toLowerCase().startsWith(v));
}

/** Returns one widget's full schema entry as pretty JSON; throws if unknown. */
export function readWidgetResource(schema: KipDashboardSchema, selector: string): string {
  const widget = schema.widgets.find((w) => w.selector === selector);
  if (!widget) {
    throw new Error(`Unknown widget "${selector}".`);
  }
  return JSON.stringify(widget, null, 2);
}

/** Lists every dashboard template as an individual `kip://template/{id}` resource. */
export function listTemplateResources(): ResourceListing[] {
  return TEMPLATES.map((t) => ({
    uri: `kip://template/${t.id}`,
    name: t.name,
    description: `The "${t.name}" dashboard template.`,
    mimeType: JSON_MIME,
  }));
}

/** Suggests template ids that start with the partial value (case-insensitive). */
export function completeTemplateId(value: string): string[] {
  const v = value.toLowerCase();
  return TEMPLATES.map((t) => t.id).filter((id) => id.toLowerCase().startsWith(v));
}

/** Returns one dashboard template as pretty JSON; throws if unknown. */
export function readTemplateResource(id: string): string {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) {
    throw new Error(`Unknown template "${id}".`);
  }
  return JSON.stringify(template, null, 2);
}
