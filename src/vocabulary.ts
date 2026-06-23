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

/** Lists the widget catalog, optionally filtered by category or plugin needs. */
export function listWidgets(
  schema: KipDashboardSchema,
  filter: ListWidgetsFilter = {},
): WidgetSummary[] {
  return schema.widgets
    .filter((w) => !filter.category || w.category === filter.category)
    .filter(
      (w) =>
        !filter.requiresNoPlugins || (w.requiredPlugins.length === 0 && !w.anyOfPlugins?.length),
    )
    .map((w) => ({
      name: w.name,
      selector: w.selector,
      category: w.category,
      description: w.description,
      bindingKind: w.bindingKind,
      minWidth: w.minWidth,
      minHeight: w.minHeight,
      defaultWidth: w.defaultWidth,
      defaultHeight: w.defaultHeight,
      requiredPlugins: w.requiredPlugins,
      ...(w.anyOfPlugins ? { anyOfPlugins: w.anyOfPlugins } : {}),
    }));
}

/** Returns the full schema entry for one widget selector. */
export function getWidgetSchema(
  schema: KipDashboardSchema,
  selector: string,
): WidgetSchemaEntry | undefined {
  return schema.widgets.find((w) => w.selector === selector);
}

/** Returns KIP's design system (grid, colours, themes, icons, units). */
export function getDesignSystem(schema: KipDashboardSchema): DesignSystem {
  return schema.designSystem;
}

/** Returns the unit group and convertible measures for a Signal K base unit. */
export function getUnitOptions(schema: KipDashboardSchema, skUnit: string): UnitOptions | null {
  const group = schema.designSystem.unitGroups.find((g) =>
    g.measures.some((m) => m.measure === skUnit),
  );
  if (!group) return null;
  return { group: group.group, skUnit, measures: group.measures };
}
