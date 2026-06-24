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
}

export interface ResolveContext {
  schema: KipDashboardSchema;
  inventory: PathInfo[];
  plugins: PluginInfo[];
  capabilities: Capabilities;
}

function stripSelf(path: string): string {
  return path.startsWith('self.') ? path.slice(5) : path;
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
      if (info.sourceCount > 1) {
        notes.push(`"${bare}" has ${info.sourceCount} sources; using the server default`);
      }
      bindings.push({
        slot: slot.slot,
        path: `self.${bare}`,
        source: 'default',
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
          source: 'default',
          convertUnitTo: chooseConvertUnit(design, info?.skUnit ?? '', {
            preferred: dw.dataChart.preferredUnit,
          }),
        };
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
      ...(dw.color ? { color: dw.color } : {}),
      ...(dw.size ? { size: dw.size } : {}),
      ...(dw.group ? { group: dw.group } : {}),
      ...(dw.needsManualConfig ? { needsManualConfig: true } : {}),
      notes,
    });
  }

  return { satisfied, dropped };
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
