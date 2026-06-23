/**
 * Pure read functions over the KIP schema — the logic behind the "design
 * vocabulary" MCP tools. Kept free of MCP/transport concerns so they are easy
 * to test and reuse.
 */
import type {
  DesignSystem,
  KipDashboardSchema,
  UnitMeasure,
  WidgetSchemaEntry,
} from './schema/schema-types.js';

/** A lightweight widget catalog entry (without the full default config). */
export interface WidgetSummary {
  name: string;
  selector: string;
  category: string;
  description: string;
  bindingKind: string;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  requiredPlugins: string[];
  anyOfPlugins?: string[];
}

export interface ListWidgetsFilter {
  category?: string;
  /** When true, return only widgets that need no plugins to work. */
  requiresNoPlugins?: boolean;
}

/** Valid unit conversions for a Signal K base unit. */
export interface UnitOptions {
  group: string;
  skUnit: string;
  measures: UnitMeasure[];
}

/** Lists the widget catalog, optionally filtered. STUB. */
export function listWidgets(_schema: KipDashboardSchema, _filter?: ListWidgetsFilter): WidgetSummary[] {
  return [];
}

/** Returns the full schema entry for one widget selector. STUB. */
export function getWidgetSchema(
  _schema: KipDashboardSchema,
  _selector: string,
): WidgetSchemaEntry | undefined {
  return undefined;
}

/** Returns KIP's design system (grid, colours, themes, icons, units). */
export function getDesignSystem(schema: KipDashboardSchema): DesignSystem {
  return schema.designSystem;
}

/** Returns the unit group and convertible measures for a Signal K base unit. STUB. */
export function getUnitOptions(_schema: KipDashboardSchema, _skUnit: string): UnitOptions | null {
  return null;
}
