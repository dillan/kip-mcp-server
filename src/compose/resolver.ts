import type { Capabilities, PathInfo } from '../discovery/inventory.js';
import type { PluginInfo } from '../discovery/sk-client.js';
import type { KipDashboardSchema, WidgetSchemaEntry } from '../schema/schema-types.js';
import type { PathsArrayControl, SlotBinding } from './node-builder.js';
import type { CapabilityGate, DashboardTemplate, DesiredWidget } from './templates.js';
import { chooseConvertUnit } from './units-match.js';

export interface ResolvedWidget {
  selector: string;
  widget: WidgetSchemaEntry;
  bindings: SlotBinding[];
  dataChart?: { path: string; source?: string | null; convertUnitTo?: string | null };
  pathControls?: PathsArrayControl[];
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
  /** Dashboard-level notes not tied to one widget (e.g. unapplied source overrides). */
  notes: string[];
}

export interface ResolveContext {
  schema: KipDashboardSchema;
  inventory: PathInfo[];
  plugins: PluginInfo[];
  capabilities: Capabilities;
  /** Per-path Signal K source override (bare path -> source id from get_path_sources). */
  sourceOverrides?: Record<string, string>;
}

function stripSelf(path: string): string {
  return path.startsWith('self.') ? path.slice(5) : path;
}

/**
 * Resolves the Signal K source for a bound path: the caller's override when one
 * was chosen (via get_path_sources), else the server default. Records a note
 * when an override is applied, plus a soft warning if the chosen source is not
 * among the path's reported sources (the override is still honoured).
 */
function pickSource(
  overrides: Record<string, string> | undefined,
  bare: string,
  info: PathInfo | undefined,
  notes: string[],
): string {
  const chosen = overrides?.[bare];
  if (!chosen) return 'default';
  notes.push(`"${bare}": using source "${chosen}" instead of the server default`);
  if (info?.sources && info.sources.length > 0 && !info.sources.includes(chosen)) {
    notes.push(
      `"${bare}": source "${chosen}" is not among the reported sources (${info.sources.join(', ')})`,
    );
  }
  return chosen;
}

export function capabilityMet(gate: CapabilityGate, c: Capabilities): boolean {
  switch (gate) {
    case 'position':
      return c.hasPosition;
    case 'speed':
      return c.hasSpeed;
    case 'heading':
      return c.hasHeading;
    case 'wind':
      return c.hasWind;
    case 'depth':
      return c.hasDepth;
    case 'environment':
      return c.hasEnvironment;
    case 'electrical':
      return c.hasElectrical;
    case 'battery':
      return c.batteryCount > 0;
    case 'engine':
      return c.engineCount > 0;
    case 'autopilot':
      return c.hasAutopilot;
  }
}

/** Binds a template's widgets to a boat's real data, dropping the unsatisfiable. */
export function resolveTemplate(template: DashboardTemplate, ctx: ResolveContext): ResolveResult {
  const enabled = new Set(ctx.plugins.filter((p) => p.enabled).map((p) => p.id));
  const byPath = new Map(ctx.inventory.map((p) => [p.path, p]));
  const design = ctx.schema.designSystem;
  const satisfied: ResolvedWidget[] = [];
  const dropped: DroppedWidget[] = [];

  for (const dw of template.widgets) {
    const gateReason = gate(dw, enabled, ctx.capabilities);
    if (gateReason) {
      dropped.push({ selector: dw.selector, reason: gateReason });
      continue;
    }

    const widget = ctx.schema.widgets.find((w) => w.selector === dw.selector);
    if (!widget) {
      dropped.push({ selector: dw.selector, reason: 'not in the widget catalog' });
      continue;
    }

    const notes: string[] = [];
    const bindings: SlotBinding[] = [];
    let unsatisfied: string | null = null;

    for (const slot of dw.slots ?? []) {
      const widgetSlot = widget.pathSlots.find((s) => s.slot === slot.slot);
      if (!widgetSlot) {
        notes.push(`slot "${slot.slot}" is not on ${widget.selector}; skipped`);
        continue;
      }
      const bare = slot.candidates.find((c) => byPath.has(c));
      if (!bare) {
        if (widgetSlot.pathRequired) unsatisfied = `no data for required slot "${slot.slot}"`;
        continue;
      }
      const info = byPath.get(bare);
      if (!info) continue;
      const source = pickSource(ctx.sourceOverrides, bare, info, notes);
      if (source === 'default' && info.sourceCount > 1) {
        notes.push(`"${bare}" has ${info.sourceCount} sources; using the server default`);
      }
      bindings.push({
        slot: slot.slot,
        path: `self.${bare}`,
        source,
        convertUnitTo: chooseConvertUnit(design, info.skUnit ?? '', {
          preferred: slot.preferredUnit,
          slotDefault: widgetSlot.defaultConvertUnitTo,
        }),
        pathSkUnitsFilter: info.skUnit ?? widgetSlot.expectedSkUnit,
      });
    }

    if (!unsatisfied) {
      const bound = new Set(bindings.map((b) => b.slot));
      for (const ps of widget.pathSlots) {
        if (!ps.pathRequired || bound.has(ps.slot)) continue;
        const def = ps.defaultPath ? stripSelf(ps.defaultPath) : null;
        if (!def || !byPath.has(def)) {
          unsatisfied = `required slot "${ps.slot}" has no data`;
          break;
        }
      }
    }

    let dataChart: ResolvedWidget['dataChart'];
    if (!unsatisfied && widget.bindingKind === 'datachart' && dw.dataChart) {
      const bare = dw.dataChart.candidates.find((c) => byPath.has(c));
      if (!bare) {
        unsatisfied = 'no data for the chart';
      } else {
        const info = byPath.get(bare);
        dataChart = {
          path: `self.${bare}`,
          source: pickSource(ctx.sourceOverrides, bare, info, notes),
          convertUnitTo: chooseConvertUnit(design, info?.skUnit ?? '', {
            preferred: dw.dataChart.preferredUnit,
          }),
        };
      }
    }

    let pathControls: ResolvedWidget['pathControls'];
    if (!unsatisfied && widget.bindingKind === 'paths-array') {
      const defaultKind = widget.selector === 'widget-zones-state-panel' ? 'zones' : 'switch';
      const resolved: PathsArrayControl[] = [];
      for (const control of dw.controls ?? []) {
        const bare = control.candidates.find((c) => byPath.has(c));
        if (!bare) continue; // a control with no data is simply left out of the panel
        const source = pickSource(ctx.sourceOverrides, bare, byPath.get(bare), notes);
        resolved.push({
          ctrlLabel: control.ctrlLabel,
          path: `self.${bare}`,
          kind: control.kind ?? defaultKind,
          ...(source !== 'default' ? { source } : {}),
          ...(control.type ? { type: control.type } : {}),
        });
      }
      // Drop an empty panel: no controls defined, or none of them had data.
      if (resolved.length === 0) {
        unsatisfied = dw.controls?.length
          ? 'no data for any switch/zones control'
          : 'paths-array widget has no controls';
      } else {
        pathControls = resolved;
      }
    }

    if (unsatisfied) {
      dropped.push({ selector: dw.selector, reason: unsatisfied });
      continue;
    }

    satisfied.push({
      selector: dw.selector,
      widget,
      bindings,
      ...(dataChart ? { dataChart } : {}),
      ...(pathControls ? { pathControls } : {}),
      ...(dw.color ? { color: dw.color } : {}),
      ...(dw.size ? { size: dw.size } : {}),
      ...(dw.group ? { group: dw.group } : {}),
      ...(dw.needsManualConfig ? { needsManualConfig: true } : {}),
      notes,
    });
  }

  // Flag any source override that never landed (a typo, or a path no satisfied
  // widget bound), so a caller isn't left thinking a silent no-op took effect.
  const boundPaths = new Set<string>();
  for (const w of satisfied) {
    for (const b of w.bindings) boundPaths.add(stripSelf(b.path));
    if (w.dataChart) boundPaths.add(stripSelf(w.dataChart.path));
    for (const c of w.pathControls ?? []) boundPaths.add(stripSelf(c.path));
  }
  const notes = Object.keys(ctx.sourceOverrides ?? {})
    .filter((path) => !boundPaths.has(path))
    .map(
      (path) => `source override for "${path}" was not applied (path not bound in this dashboard)`,
    );

  return { satisfied, dropped, notes };
}

function gate(dw: DesiredWidget, enabled: Set<string>, capabilities: Capabilities): string | null {
  if (dw.requiredPlugins && !dw.requiredPlugins.every((p) => enabled.has(p))) {
    return `missing required plugin(s): ${dw.requiredPlugins.join(', ')}`;
  }
  if (
    dw.anyOfPlugins &&
    dw.anyOfPlugins.length > 0 &&
    !dw.anyOfPlugins.some((p) => enabled.has(p))
  ) {
    return `needs one of plugins: ${dw.anyOfPlugins.join(', ')}`;
  }
  if (dw.capabilityGate && !capabilityMet(dw.capabilityGate, capabilities)) {
    return `no ${dw.capabilityGate} data`;
  }
  return null;
}
