import { readFileSync } from 'node:fs';
import { deriveCapabilities, flattenVesselData } from '../discovery/inventory.js';
import { loadBundledSchema } from '../schema/kip-schema.js';
import { resolveTemplate, type ResolveContext } from './resolver.js';
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

const mustGet = (id: string): DashboardTemplate => {
  const t = getTemplate(id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};

describe('resolveTemplate', () => {
  it('satisfies all general widgets on a well-equipped boat', () => {
    const result = resolveTemplate(mustGet('general'), ctx);
    expect(result.dropped).toHaveLength(0);
    expect(result.satisfied.map((w) => w.selector)).toEqual([
      'widget-position',
      'widget-numeric',
      'widget-numeric',
      'widget-gauge-ng-compass',
      'widget-numeric',
    ]);
  });

  it('binds paths with the self prefix and sensible units', () => {
    const result = resolveTemplate(mustGet('general'), ctx);
    const sog = result.satisfied.find((w) =>
      w.bindings.some((b) => b.path.endsWith('speedOverGround')),
    );
    expect(sog?.bindings[0]?.path).toBe('self.navigation.speedOverGround');
    expect(sog?.bindings[0]?.convertUnitTo).toBe('knots');

    const compass = result.satisfied.find((w) => w.selector === 'widget-gauge-ng-compass');
    expect(compass?.bindings[0]?.convertUnitTo).toBe('deg');
  });

  it('drops a widget whose required path is missing (heel needs attitude)', () => {
    const result = resolveTemplate(mustGet('sailing'), ctx);
    expect(result.satisfied.map((w) => w.selector)).toEqual(
      expect.arrayContaining(['widget-wind-steer', 'widget-numeric']),
    );
    expect(result.dropped.map((d) => d.selector)).toContain('widget-heel-gauge');
  });

  it('capability-gates the battery monitor and flags it for manual config', () => {
    const result = resolveTemplate(mustGet('power'), ctx);
    const bms = result.satisfied.find((w) => w.selector === 'widget-bms');
    expect(bms?.needsManualConfig).toBe(true);
  });

  it('drops capability-gated widgets when the data is absent', () => {
    const bare: ResolveContext = { ...ctx, inventory: [], capabilities: deriveCapabilities([]) };
    const result = resolveTemplate(mustGet('general'), bare);
    expect(result.satisfied).toHaveLength(0);
    expect(result.dropped.length).toBeGreaterThan(0);
  });
});

describe('resolveTemplate paths-array controls', () => {
  const switchPath = {
    path: 'electrical.switches.nav.state',
    skUnit: null,
    description: null,
    displayName: null,
    hasZones: false,
    pathType: 'boolean',
    sampleValue: false,
    sourceCount: 1,
  };

  it('resolves a paths-array control to a self-prefixed path', () => {
    const tmpl: DashboardTemplate = {
      id: 'x',
      name: 'X',
      icon: 'dashboard-dashboard',
      widgets: [
        {
          selector: 'widget-boolean-switch',
          controls: [{ ctrlLabel: 'Nav', candidates: ['electrical.switches.nav.state'] }],
        },
      ],
    };
    const localCtx: ResolveContext = {
      schema,
      inventory: [switchPath],
      plugins: [],
      capabilities: deriveCapabilities([]),
    };
    const result = resolveTemplate(tmpl, localCtx);
    expect(result.satisfied).toHaveLength(1);
    expect(result.satisfied[0].pathControls).toEqual([
      { ctrlLabel: 'Nav', path: 'self.electrical.switches.nav.state', kind: 'switch' },
    ]);
  });

  it('drops a paths-array widget when no control candidate has data', () => {
    const tmpl: DashboardTemplate = {
      id: 'x',
      name: 'X',
      icon: 'dashboard-dashboard',
      widgets: [
        {
          selector: 'widget-boolean-switch',
          controls: [{ ctrlLabel: 'Nav', candidates: ['electrical.switches.missing.state'] }],
        },
      ],
    };
    const localCtx: ResolveContext = {
      schema,
      inventory: [],
      plugins: [],
      capabilities: deriveCapabilities([]),
    };
    const result = resolveTemplate(tmpl, localCtx);
    expect(result.satisfied).toHaveLength(0);
    expect(result.dropped.map((d) => d.selector)).toContain('widget-boolean-switch');
  });

  it('drops a paths-array widget that defines no controls (no empty panels)', () => {
    const tmpl: DashboardTemplate = {
      id: 'x',
      name: 'X',
      icon: 'dashboard-dashboard',
      widgets: [{ selector: 'widget-boolean-switch' }],
    };
    const result = resolveTemplate(tmpl, ctx);
    expect(result.satisfied).toHaveLength(0);
    expect(result.dropped.map((d) => d.selector)).toContain('widget-boolean-switch');
  });
});
