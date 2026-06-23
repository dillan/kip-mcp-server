import type { Capabilities, PathInfo } from '../discovery/inventory.js';
import type { PluginInfo } from '../discovery/sk-client.js';
import type { KipDashboardSchema, WidgetSchemaEntry } from '../schema/schema-types.js';
import type { SlotBinding } from './node-builder.js';
import type { CapabilityGate, DashboardTemplate } from './templates.js';

export interface ResolvedWidget {
  selector: string;
  widget: WidgetSchemaEntry;
  bindings: SlotBinding[];
  dataChart?: { path: string; source?: string | null; convertUnitTo?: string | null };
  color?: string;
  size?: { w: number; h: number };
  group?: string;
  needsManualConfig?: boolean;
  notes: string[];
}

export interface DroppedWidget {
  selector: string;
  reason: string;
}

export interface ResolveResult {
  satisfied: ResolvedWidget[];
  dropped: DroppedWidget[];
}

export interface ResolveContext {
  schema: KipDashboardSchema;
  inventory: PathInfo[];
  plugins: PluginInfo[];
  capabilities: Capabilities;
}

/** Binds a template's widgets to a boat's real data, dropping the unsatisfiable. STUB. */
export function resolveTemplate(_template: DashboardTemplate, _ctx: ResolveContext): ResolveResult {
  return { satisfied: [], dropped: [] };
}

export function capabilityMet(_gate: CapabilityGate, _capabilities: Capabilities): boolean {
  return false;
}
