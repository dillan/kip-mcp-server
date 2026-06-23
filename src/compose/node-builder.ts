import { cloneDeep, merge } from 'lodash';
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
 */
export function buildWidgetNode(input: BuildWidgetInput): GridNode {
  const config = merge(
    cloneDeep(input.widget.defaultConfig),
    cloneDeep(input.configOverrides ?? {}),
  ) as Record<string, unknown>;

  if (input.widget.bindingKind === 'paths-record' && input.bindings) {
    const paths = (
      config.paths && typeof config.paths === 'object' ? config.paths : {}
    ) as Record<string, Record<string, unknown>>;
    for (const binding of input.bindings) {
      const slot = (paths[binding.slot] ?? {}) as Record<string, unknown>;
      slot.path = binding.path;
      slot.source = binding.source ?? slot.source ?? 'default';
      if (binding.convertUnitTo != null) slot.convertUnitTo = binding.convertUnitTo;
      if (binding.pathSkUnitsFilter != null) slot.pathSkUnitsFilter = binding.pathSkUnitsFilter;
      paths[binding.slot] = slot;
    }
    config.paths = paths;
  }

  if (input.widget.bindingKind === 'datachart' && input.dataChart) {
    config.datachartPath = input.dataChart.path;
    if (input.dataChart.source != null) config.datachartSource = input.dataChart.source;
    if (input.dataChart.convertUnitTo != null) config.convertUnitTo = input.dataChart.convertUnitTo;
  }

  if (input.color) config.color = input.color;

  const { x, y, w, h } = input.position;
  return {
    w,
    h,
    x,
    y,
    id: input.uuid,
    selector: 'widget-host2',
    input: { widgetProperties: { type: input.widget.selector, uuid: input.uuid, config } },
  };
}
