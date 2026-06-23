/**
 * Types describing the generated KIP dashboard schema artifact that this server
 * consumes. They mirror the artifact produced by KIP's `gen:mcp-schema` tool.
 */

export type WidgetCategory = 'Core' | 'Gauge' | 'Component' | 'Racing';

/** How a widget binds Signal K data (derived from its DEFAULT_CONFIG). */
export type BindingKind = 'paths-record' | 'paths-array' | 'datachart' | 'none';

/** One data slot of a `paths-record` widget. */
export interface PathSlot {
  slot: string;
  description: string | null;
  defaultPath: string | null;
  source: string | null;
  pathType: string | null;
  isPathConfigurable: boolean;
  pathRequired: boolean;
  defaultConvertUnitTo: string | null;
  expectedSkUnit: string | null;
  sampleTime: number | null;
}

/** A widget plus its default config, binding kind and path slots. */
export interface WidgetSchemaEntry {
  name: string;
  selector: string;
  componentClassName: string;
  category: WidgetCategory;
  description: string;
  icon: string;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  requiredPlugins: string[];
  anyOfPlugins?: string[];
  bindingKind: BindingKind;
  defaultConfig: Record<string, unknown>;
  pathSlots: PathSlot[];
}

export interface ColorToken {
  value: string;
  label: string;
}

export interface UnitMeasure {
  measure: string;
  description: string;
}

export interface UnitGroup {
  group: string;
  measures: UnitMeasure[];
}

export interface GridGeometry {
  column: number;
  row: number;
  margin: number;
  float: boolean;
  cellHeight: string;
}

export interface DesignSystem {
  grid: GridGeometry;
  colors: ColorToken[];
  themeNames: string[];
  icons: string[];
  unitGroups: UnitGroup[];
}

export interface SchemaMeta {
  schemaVersion: number;
  kipVersion: string;
  configFileVersion: number;
  configVersion: number;
}

export interface KipDashboardSchema {
  meta: SchemaMeta;
  widgets: WidgetSchemaEntry[];
  designSystem: DesignSystem;
}
