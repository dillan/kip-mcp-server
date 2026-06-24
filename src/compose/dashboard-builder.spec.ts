import { readFileSync } from 'node:fs';
import { deriveCapabilities, flattenVesselData } from '../discovery/inventory.js';
import { loadBundledSchema } from '../schema/kip-schema.js';
import { composeDashboard, previewAscii, previewSvg } from './dashboard-builder.js';
import type { ResolveContext } from './resolver.js';
import { getTemplate, type DashboardTemplate } from './templates.js';

const schema = loadBundledSchema();
const self = JSON.parse(
  readFileSync(new URL('../discovery/fixtures/sailboat-self.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const inventory = flattenVesselData(self);
const ctx: ResolveContext = {
  schema,
  inventory,
  plugins: [],
  capabilities: deriveCapabilities(inventory),
};

let counter = 0;
const uuid = (): string => `id-${(counter += 1)}`;
const template = (id: string): DashboardTemplate => {
  const t = getTemplate(id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};

describe('composeDashboard', () => {
  it('builds a Dashboard with placed, byte-compatible nodes', () => {
    counter = 0;
    const { dashboard } = composeDashboard(template('general'), ctx, uuid);
    expect(dashboard.id).toBe('id-1');
    expect(dashboard.name).toBe('Overview');
    expect(dashboard.icon).toBe('dashboard-dashboard');
    expect(dashboard.collapseSplitShell).toBe(false);
    expect(dashboard.configuration).toHaveLength(5);
    for (const node of dashboard.configuration) {
      expect(node.selector).toBe('widget-host2');
      expect(node.id).toBe(node.input.widgetProperties.uuid);
      expect(node.x + node.w).toBeLessThanOrEqual(24);
    }
  });

  it('lets the caller override name and icon', () => {
    counter = 0;
    const { dashboard } = composeDashboard(template('general'), ctx, uuid, {
      name: 'My Nav',
      icon: 'dashboard-compass2',
    });
    expect(dashboard.name).toBe('My Nav');
    expect(dashboard.icon).toBe('dashboard-compass2');
  });

  it('reports dropped widgets and notes', () => {
    counter = 0;
    const result = composeDashboard(template('power'), ctx, uuid);
    expect(result.notes.some((n) => n.includes('needs manual configuration'))).toBe(true);
    const sailing = composeDashboard(template('sailing'), ctx, uuid);
    expect(sailing.dropped.map((d) => d.selector)).toContain('widget-heel-gauge');
  });
});

describe('previewAscii', () => {
  it('renders a bordered ascii grid', () => {
    counter = 0;
    const { dashboard } = composeDashboard(template('general'), ctx, uuid);
    const ascii = previewAscii(dashboard);
    expect(ascii.split('\n')[0]).toMatch(/^\+-+\+$/);
    expect(ascii).toContain('|');
  });
});

describe('previewSvg', () => {
  it('renders an svg with a rectangle per widget, using the colour map with a grey fallback', () => {
    counter = 0;
    const { dashboard } = composeDashboard(template('general'), ctx, uuid);
    const svg = previewSvg(dashboard, new Map([['blue', '#3298ff']]));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
    // one background rect plus one per widget
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(
      dashboard.configuration.length + 1,
    );
    expect(svg).toContain('#888888');
  });

  it('does not throw on a malformed dashboard', () => {
    const svg = previewSvg(
      { configuration: [null, { x: 0, y: 0, w: 2, h: 2 }] } as unknown as Parameters<
        typeof previewSvg
      >[0],
      new Map(),
    );
    expect(svg.startsWith('<svg')).toBe(true);
  });
});

describe('composeDashboard paths-array', () => {
  it('threads paths-array controls into linked, index-aligned config arrays', () => {
    counter = 0;
    const localCtx: ResolveContext = {
      schema,
      inventory: ['electrical.switches.nav.state', 'electrical.switches.anchor.state'].map(
        (path) => ({
          path,
          skUnit: null,
          description: null,
          displayName: null,
          hasZones: false,
          pathType: 'boolean',
          sampleValue: false,
          sourceCount: 1,
        }),
      ),
      plugins: [],
      capabilities: deriveCapabilities([]),
    };
    const tmpl: DashboardTemplate = {
      id: 'switches',
      name: 'Switches',
      icon: 'dashboard-dashboard',
      widgets: [
        {
          selector: 'widget-boolean-switch',
          controls: [
            { ctrlLabel: 'Nav', candidates: ['electrical.switches.nav.state'] },
            { ctrlLabel: 'Anchor', candidates: ['electrical.switches.anchor.state'] },
            { ctrlLabel: 'Missing', candidates: ['electrical.switches.absent.state'] },
          ],
        },
      ],
    };
    const { dashboard } = composeDashboard(tmpl, localCtx, uuid);
    expect(dashboard.configuration).toHaveLength(1);
    const cfg = dashboard.configuration[0].input.widgetProperties.config as unknown as {
      paths: Array<{ path: string; pathID: string }>;
      multiChildCtrls: Array<{ pathID: string }>;
    };
    // 2 of 3 controls have data; the missing one is left out
    expect(cfg.paths.map((p) => p.path)).toEqual([
      'self.electrical.switches.nav.state',
      'self.electrical.switches.anchor.state',
    ]);
    // index-aligned, shared pathIDs, all unique
    expect(cfg.paths.map((p) => p.pathID)).toEqual(cfg.multiChildCtrls.map((c) => c.pathID));
    expect(new Set(cfg.paths.map((p) => p.pathID)).size).toBe(2);
  });
});
