import lodash from 'lodash';
import type { WidgetSchemaEntry } from '../schema/schema-types.js';

// lodash is CommonJS; Node ESM can't statically import its named exports, so we
// default-import the namespace and destructure at runtime.
const { cloneDeep, merge } = lodash;

/** A Signal K path binding for one `paths-record` slot. */
export interface SlotBinding {
  slot: string;
  path: string;
  source?: string | null;
  convertUnitTo?: string | null;
  pathSkUnitsFilter?: string | null;
}

/**
 * One control of a `paths-array` widget (a switch or zones panel). KIP links a
 * control to its data path by a shared `pathID`, and observes the stream by the
 * path entry's array index, so the builder emits the two arrays in lockstep.
 */
export interface PathsArrayControl {
  ctrlLabel: string;
  /** Signal K path, self-prefixed (e.g. `self.electrical.switches.nav.state`). */
  path: string;
  kind: 'switch' | 'zones';
  source?: string | null;
  /** Control type code: '1' toggle / '3' indicator for a switch, '4' for zones. */
  type?: string;
  color?: string;
  pathSkUnitsFilter?: string | null;
  convertUnitTo?: string | null;
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
  /** Controls for a `paths-array` widget (switch / zones panels). */
  pathControls?: PathsArrayControl[];
  /** Id generator for the per-control pathIDs (defaults to crypto.randomUUID). */
  genId?: () => string;
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
    const paths = (config.paths && typeof config.paths === 'object' ? config.paths : {}) as Record<
      string,
      Record<string, unknown>
    >;
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
