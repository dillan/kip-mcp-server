/**
 * Structural validation of a KIP dashboard against the schema. Catches the
 * byte-compatibility invariants KIP relies on (node id === uuid, the widget-host2
 * selector, known widget types, grid bounds, no overlaps) and warns on unknown
 * colour/icon/unit tokens. Tolerant of unknown extra config keys.
 */
import type { KipDashboardSchema } from './schema/schema-types.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Validates a dashboard's structure against the schema. STUB. */
export function validateDashboard(_dashboard: unknown, _schema: KipDashboardSchema): ValidationResult {
  return { ok: true, errors: [], warnings: [] };
}
