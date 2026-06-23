/**
 * Structural validation of a KIP dashboard against the schema. Catches the
 * byte-compatibility invariants KIP relies on (node id === uuid, the widget-host2
 * selector, known widget types, grid bounds, no overlaps) and warns on unknown
 * colour/icon/unit tokens. Tolerant of unknown extra config keys.
 */
import type { KipDashboardSchema } from './schema/schema-types.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function checkUnit(value: unknown, measures: Set<string>, where: string, warnings: string[]): void {
  if (typeof value === 'string' && value !== '' && !measures.has(value)) {
    warnings.push(`${where}: convertUnitTo "${value}" is not a known KIP unit`);
  }
}

/** Validates a dashboard's structure against the schema. */
export function validateDashboard(dashboard: unknown, schema: KipDashboardSchema): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const selectors = new Set(schema.widgets.map((w) => w.selector));
  const columns = schema.designSystem.grid.column;
  const colorTokens = new Set(schema.designSystem.colors.map((c) => c.value));
  const icons = new Set(schema.designSystem.icons);
  const measures = new Set(schema.designSystem.unitGroups.flatMap((g) => g.measures.map((m) => m.measure)));
  measures.add('unitless');

  if (!dashboard || typeof dashboard !== 'object') {
    return { ok: false, errors: ['dashboard is not an object'], warnings };
  }
  const d = dashboard as { icon?: unknown; configuration?: unknown };

  if (typeof d.icon === 'string' && !icons.has(d.icon)) {
    warnings.push(`dashboard icon "${d.icon}" is not a known KIP icon`);
  }
  if (!Array.isArray(d.configuration)) {
    return { ok: false, errors: ['dashboard.configuration must be an array'], warnings };
  }

  const rects: Rect[] = [];

  d.configuration.forEach((raw, i) => {
    const where = `node[${i}]`;
    const node = raw as {
      id?: unknown;
      selector?: unknown;
      x?: unknown;
      y?: unknown;
      w?: unknown;
      h?: unknown;
      input?: { widgetProperties?: { type?: unknown; uuid?: unknown; config?: unknown } };
    };

    if (node.selector !== 'widget-host2') {
      errors.push(`${where}: selector must be "widget-host2"`);
    }
    const wp = node.input?.widgetProperties;
    if (!wp) {
      errors.push(`${where}: missing input.widgetProperties`);
      return;
    }
    if (node.id !== wp.uuid) {
      errors.push(`${where}: id must equal input.widgetProperties.uuid`);
    }
    if (typeof wp.type !== 'string' || !selectors.has(wp.type)) {
      errors.push(`${where}: unknown widget type "${String(wp.type)}"`);
    }

    if (![node.x, node.y, node.w, node.h].every((v) => typeof v === 'number')) {
      errors.push(`${where}: x, y, w and h must be numbers`);
    } else {
      const x = node.x as number;
      const y = node.y as number;
      const w = node.w as number;
      const h = node.h as number;
      if (x < 0 || y < 0) errors.push(`${where}: x and y must be >= 0`);
      if (x + w > columns) errors.push(`${where}: x+w (${x + w}) exceeds the ${columns}-column grid`);
      rects.push({ id: String(node.id), x, y, w, h });
    }

    const config = wp.config;
    if (config && typeof config === 'object') {
      const cfg = config as Record<string, unknown>;
      if (typeof cfg.color === 'string' && !cfg.color.startsWith('#') && !colorTokens.has(cfg.color)) {
        warnings.push(`${where}: colour "${cfg.color}" is not a known token`);
      }
      checkUnit(cfg.convertUnitTo, measures, where, warnings);
      const paths = cfg.paths;
      if (paths && typeof paths === 'object' && !Array.isArray(paths)) {
        for (const [slot, slotCfg] of Object.entries(paths as Record<string, unknown>)) {
          if (!slotCfg || typeof slotCfg !== 'object') continue;
          const sc = slotCfg as Record<string, unknown>;
          checkUnit(sc.convertUnitTo, measures, `${where}.paths.${slot}`, warnings);
          if (typeof sc.path === 'string' && sc.path !== '' && !sc.path.startsWith('self.')) {
            warnings.push(`${where}.paths.${slot}: path "${sc.path}" does not start with "self."`);
          }
        }
      }
    }
  });

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (overlaps(rects[i], rects[j])) {
        errors.push(`nodes ${rects[i].id} and ${rects[j].id} overlap`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
