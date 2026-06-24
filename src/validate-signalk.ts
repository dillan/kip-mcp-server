/**
 * Checks a KIP dashboard against the LIVE boat: every bound Signal K path exists
 * in the inventory, the widgets' required plugins are installed and enabled, and
 * the declared units line up with the real meta.units. The network-free twin of
 * this is `validateDashboard` (src/validators.ts); this one needs discovered data.
 */
import type { DiscoveryResult } from './discovery/discover.js';
import type { KipDashboardSchema, WidgetSchemaEntry } from './schema/schema-types.js';

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

interface Binding {
  slot: string | null;
  rawPath: string;
  barePath: string;
  declaredSkUnit: string | null;
}

function stripSelf(path: string): string {
  return path.startsWith('self.') ? path.slice(5) : path;
}

export function validateAgainstSignalk(
  schema: KipDashboardSchema,
  dashboard: unknown,
  discovery: DiscoveryResult,
): ValidateAgainstResult {
  const catalog = new Map(schema.widgets.map((w) => [w.selector, w]));
  const byPath = new Map(discovery.paths.map((p) => [p.path, p]));
  const installed = new Set(discovery.plugins.map((p) => p.id));
  const enabled = new Set(discovery.plugins.filter((p) => p.enabled).map((p) => p.id));

  const missingPaths: PathCheck[] = [];
  const pluginIssues: PluginIssue[] = [];
  const unitMismatches: UnitMismatch[] = [];
  const warnings: string[] = [];
  let checkedPaths = 0;

  const config = (dashboard ?? {}) as { configuration?: unknown };
  const nodes = Array.isArray(config.configuration) ? config.configuration : [];

  nodes.forEach((raw, i) => {
    const where = `node[${i}]`;
    if (!raw || typeof raw !== 'object') {
      warnings.push(`${where}: not a widget node; skipping.`);
      return;
    }
    const node = raw as { input?: { widgetProperties?: { type?: unknown; config?: unknown } } };
    const wp = node.input?.widgetProperties;
    const type = typeof wp?.type === 'string' ? wp.type : '';
    const widget = catalog.get(type);
    if (!widget) {
      warnings.push(`${where}: unknown widget type "${type}"; cannot check it against Signal K.`);
      return;
    }

    for (const plugin of widget.requiredPlugins) {
      if (!installed.has(plugin))
        pluginIssues.push({ where, widgetType: type, plugin, state: 'missing' });
      else if (!enabled.has(plugin))
        pluginIssues.push({ where, widgetType: type, plugin, state: 'disabled' });
    }
    if (widget.anyOfPlugins?.length && !widget.anyOfPlugins.some((p) => enabled.has(p))) {
      warnings.push(
        `${where} (${type}): none of the optional plugins are enabled (${widget.anyOfPlugins.join(', ')}).`,
      );
    }

    for (const binding of extractBindings(widget, wp?.config)) {
      checkedPaths += 1;
      const label = `${where}.${binding.slot ?? 'path'}`;
      if (!binding.rawPath.startsWith('self.')) {
        warnings.push(
          `${label}: "${binding.rawPath}" is not a self path; checking it as "${binding.barePath}".`,
        );
      }
      const live = byPath.get(binding.barePath);
      if (!live) {
        missingPaths.push({ where, widgetType: type, slot: binding.slot, path: binding.rawPath });
        continue;
      }
      if (binding.declaredSkUnit) {
        if (live.skUnit == null) {
          warnings.push(
            `${label}: the boat reports no units for "${binding.barePath}", so the declared unit "${binding.declaredSkUnit}" can't be confirmed.`,
          );
        } else if (live.skUnit !== binding.declaredSkUnit) {
          unitMismatches.push({
            where,
            path: binding.rawPath,
            declared: binding.declaredSkUnit,
            live: live.skUnit,
          });
        }
      }
    }
  });

  const ok = missingPaths.length === 0 && pluginIssues.length === 0 && unitMismatches.length === 0;
  return { ok, checkedPaths, missingPaths, pluginIssues, unitMismatches, warnings };
}

/** Pulls the bound Signal K paths out of a widget's config, per binding kind. */
function extractBindings(widget: WidgetSchemaEntry, configRaw: unknown): Binding[] {
  if (!configRaw || typeof configRaw !== 'object') return [];
  const config = configRaw as Record<string, unknown>;
  const expectedUnit = new Map(widget.pathSlots.map((s) => [s.slot, s.expectedSkUnit]));
  const out: Binding[] = [];

  if (widget.bindingKind === 'paths-record') {
    const paths = config.paths;
    if (paths && typeof paths === 'object' && !Array.isArray(paths)) {
      for (const [slot, slotRaw] of Object.entries(paths as Record<string, unknown>)) {
        const binding = toBinding(slot, slotRaw, expectedUnit.get(slot) ?? null);
        if (binding) out.push(binding);
      }
    }
  } else if (widget.bindingKind === 'paths-array') {
    const paths = config.paths;
    if (Array.isArray(paths)) {
      paths.forEach((entry, j) => {
        const binding = toBinding(String(j), entry, null);
        if (binding) out.push(binding);
      });
    }
  } else if (widget.bindingKind === 'datachart') {
    const rawPath = typeof config.datachartPath === 'string' ? config.datachartPath : null;
    if (rawPath)
      out.push({ slot: null, rawPath, barePath: stripSelf(rawPath), declaredSkUnit: null });
  }

  return out;
}

function toBinding(slot: string, slotRaw: unknown, fallbackUnit: string | null): Binding | null {
  if (!slotRaw || typeof slotRaw !== 'object') return null;
  const slotCfg = slotRaw as Record<string, unknown>;
  const rawPath = typeof slotCfg.path === 'string' && slotCfg.path !== '' ? slotCfg.path : null;
  if (!rawPath) return null;
  const declaredSkUnit =
    typeof slotCfg.pathSkUnitsFilter === 'string' ? slotCfg.pathSkUnitsFilter : fallbackUnit;
  return { slot, rawPath, barePath: stripSelf(rawPath), declaredSkUnit };
}
