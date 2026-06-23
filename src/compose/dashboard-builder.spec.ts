import { readFileSync } from 'node:fs';
import { deriveCapabilities, flattenVesselData } from '../discovery/inventory.js';
import { loadBundledSchema } from '../schema/kip-schema.js';
import { composeDashboard, previewAscii } from './dashboard-builder.js';
import type { ResolveContext } from './resolver.js';
import { getTemplate, type DashboardTemplate } from './templates.js';

const schema = loadBundledSchema();
const self = JSON.parse(
  readFileSync(new URL('../discovery/fixtures/sailboat-self.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const inventory = flattenVesselData(self);
const ctx: ResolveContext = { schema, inventory, plugins: [], capabilities: deriveCapabilities(inventory) };

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
