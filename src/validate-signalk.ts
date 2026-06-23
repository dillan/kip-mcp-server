/**
 * Checks a KIP dashboard against the LIVE boat: every bound Signal K path exists
 * in the inventory, the widgets' required plugins are installed and enabled, and
 * the declared units line up with the real meta.units. The network-free twin of
 * this is `validateDashboard` (src/validators.ts); this one needs discovered data.
 */
import type { DiscoveryResult } from './discovery/discover.js';
import type { KipDashboardSchema } from './schema/schema-types.js';

export interface PathCheck {
  where: string;
  widgetType: string;
  slot: string | null;
  path: string;
}

export interface PluginIssue {
  where: string;
  widgetType: string;
  plugin: string;
  state: 'missing' | 'disabled';
}

export interface UnitMismatch {
  where: string;
  path: string;
  declared: string;
  live: string;
}

export interface ValidateAgainstResult {
  ok: boolean;
  checkedPaths: number;
  missingPaths: PathCheck[];
  pluginIssues: PluginIssue[];
  unitMismatches: UnitMismatch[];
  warnings: string[];
}

export function validateAgainstSignalk(
  _schema: KipDashboardSchema,
  _dashboard: unknown,
  _discovery: DiscoveryResult,
): ValidateAgainstResult {
  throw new Error('validateAgainstSignalk not implemented');
}
