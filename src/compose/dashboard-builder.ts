import { shelfPack, type SizedWidget } from './layout.js';
import { buildWidgetNode, type GridNode } from './node-builder.js';
import { resolveTemplate, type ResolveContext } from './resolver.js';
import type { DashboardTemplate } from './templates.js';

/** A KIP dashboard, as stored in the config's `dashboards` array. */
export interface Dashboard {
  id: string;
  name: string;
  icon: string;
  collapseSplitShell: boolean;
  configuration: GridNode[];
}

export interface ComposeResult {
  dashboard: Dashboard;
  dropped: { selector: string; reason: string }[];
  notes: string[];
}

export interface ComposeOverride {
  name?: string;
  icon?: string;
}

/**
 * Resolves a template against a boat, lays the satisfied widgets out in the
 * 24-column grid and builds a byte-compatible Dashboard.
 */
export function composeDashboard(
  template: DashboardTemplate,
  ctx: ResolveContext,
  nextUuid: () => string,
  override: ComposeOverride = {},
): ComposeResult {
  const resolved = resolveTemplate(template, ctx);

  const sized: SizedWidget[] = resolved.satisfied.map((w) => {
    const size = w.size ?? { w: w.widget.defaultWidth, h: w.widget.defaultHeight };
    return {
      selector: w.selector,
      w: Math.max(size.w, w.widget.minWidth),
      h: Math.max(size.h, w.widget.minHeight),
      ...(w.group ? { group: w.group } : {}),
    };
  });
  const placed = shelfPack(sized, ctx.schema.designSystem.grid.column);

  const id = nextUuid();
  const configuration = placed.map((p, i) => {
    const w = resolved.satisfied[i];
    return buildWidgetNode({
      widget: w.widget,
      uuid: nextUuid(),
      position: { x: p.x, y: p.y, w: p.w, h: p.h },
      ...(w.color ? { color: w.color } : {}),
      bindings: w.bindings,
      ...(w.dataChart ? { dataChart: w.dataChart } : {}),
      ...(w.pathControls ? { pathControls: w.pathControls, genId: nextUuid } : {}),
    });
  });

  const notes = resolved.satisfied.flatMap((w) => [
    ...w.notes.map((n) => `${w.selector}: ${n}`),
    ...(w.needsManualConfig ? [`${w.selector}: needs manual configuration in KIP`] : []),
  ]);

  return {
    dashboard: {
      id,
      name: override.name ?? template.name,
      icon: override.icon ?? template.icon,
      collapseSplitShell: false,
      configuration,
    },
    dropped: resolved.dropped,
    notes,
  };
}

function abbreviate(type: string): string {
  return type.replace(/^widget-/, '');
}

/** Renders a simple ASCII grid of a dashboard for quick visual approval. */
export function previewAscii(dashboard: Dashboard, columns = 24): string {
  const nodes = dashboard.configuration;
  const rows = Math.max(1, ...nodes.map((n) => n.y + n.h));
  const canvas: string[][] = Array.from({ length: rows }, () => Array<string>(columns).fill(' '));

  for (const node of nodes) {
    for (let y = node.y; y < node.y + node.h && y < rows; y++) {
      for (let x = node.x; x < node.x + node.w && x < columns; x++) {
        canvas[y][x] = '·';
      }
    }
    const label = abbreviate(node.input.widgetProperties.type).slice(0, Math.max(1, node.w));
    for (let k = 0; k < label.length && node.x + k < columns; k++) {
      canvas[node.y][node.x + k] = label[k];
    }
  }

  const border = `+${'-'.repeat(columns)}+`;
  return [border, ...canvas.map((r) => `|${r.join('')}|`), border].join('\n');
}

const SVG_CELL = 16;
const SVG_DEFAULT_FILL = '#888888';

function escapeXml(value: string): string {
  return value.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Renders a dashboard's grid as an SVG: one coloured rectangle per widget, on the
 * 24-column grid. Widget colours come from the token->hex map (built from the
 * schema's design system); widgets with no colour, or when the map has no hex for
 * the token, fall back to a neutral grey. Tolerant of malformed nodes.
 */
export function previewSvg(
  dashboard: Dashboard,
  colorHex: Map<string, string>,
  columns = 24,
): string {
  const nodes = (Array.isArray(dashboard.configuration) ? dashboard.configuration : []).filter(
    (n): n is GridNode => Boolean(n) && typeof n === 'object',
  );
  const rows = Math.max(1, ...nodes.map((n) => num(n.y) + num(n.h, 1)));
  const width = columns * SVG_CELL;
  const height = rows * SVG_CELL;
  const rects = nodes
    .map((node) => {
      const x = num(node.x) * SVG_CELL;
      const y = num(node.y) * SVG_CELL;
      const w = num(node.w, 1) * SVG_CELL;
      const h = num(node.h, 1) * SVG_CELL;
      const token = (node.input?.widgetProperties?.config as { color?: string } | undefined)?.color;
      const fill = (token && colorHex.get(token)) || SVG_DEFAULT_FILL;
      const label = escapeXml(abbreviate(node.input?.widgetProperties?.type ?? ''));
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#222" stroke-width="1"/>` +
        `<text x="${x + 3}" y="${y + 12}" font-size="9" fill="#000">${label}</text>`
      );
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#0b0f14"/>${rects}</svg>`
  );
}
