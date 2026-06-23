import type { WidgetSchemaEntry } from '../schema/schema-types.js';

/** A Signal K path binding for one `paths-record` slot. */
export interface SlotBinding {
  slot: string;
  path: string;
  source?: string | null;
  convertUnitTo?: string | null;
  pathSkUnitsFilter?: string | null;
}

export interface BuildWidgetInput {
  widget: WidgetSchemaEntry;
  /** Stable id; the GridStack node id and widgetProperties.uuid are both set to this. */
  uuid: string;
  position: { x: number; y: number; w: number; h: number };
  color?: string;
  /** Path bindings for a `paths-record` widget. */
  bindings?: SlotBinding[];
  /** Top-level chart binding for a `datachart` widget. */
  dataChart?: { path: string; source?: string | null; convertUnitTo?: string | null };
  /** Extra config to merge over the widget's default config. */
  configOverrides?: Record<string, unknown>;
}

/** A GridStack node as KIP stores it inside a dashboard's `configuration`. */
export interface GridNode {
  w: number;
  h: number;
  x: number;
  y: number;
  id: string;
  selector: 'widget-host2';
  input: { widgetProperties: { type: string; uuid: string; config: Record<string, unknown> } };
}

/**
 * Builds a byte-compatible KIP widget node: config = merge(DEFAULT_CONFIG,
 * overrides) with bindings applied per binding kind, the GridStack selector fixed
 * to `widget-host2`, and node id === widgetProperties.uuid.
 *
 * STUB: implemented in the GREEN step.
 */
export function buildWidgetNode(_input: BuildWidgetInput): GridNode {
  throw new Error('not implemented');
}
