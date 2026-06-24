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

describe('resolveTemplate source overrides', () => {
  // navigation.speedOverGround in the fixture reports sources gps.0 (default) and gps.1.
  const sogBinding = (result: ReturnType<typeof resolveTemplate>) =>
    result.satisfied.flatMap((w) => w.bindings).find((b) => b.path.endsWith('speedOverGround'));

  it('binds the server default source when no override is given', () => {
    expect(sogBinding(resolveTemplate(mustGet('general'), ctx))?.source).toBe('default');
  });

  it('binds a chosen source and notes the override', () => {
    const result = resolveTemplate(mustGet('general'), {
      ...ctx,
      sourceOverrides: { 'navigation.speedOverGround': 'gps.1' },
    });
    expect(sogBinding(result)?.source).toBe('gps.1');
    const notes = result.satisfied.flatMap((w) => w.notes).join(' ');
    expect(notes).toContain('using source "gps.1"');
    expect(notes).not.toContain('not among the reported sources');
  });

  it('honours an unknown source but warns it is not among the reported sources', () => {
    const result = resolveTemplate(mustGet('general'), {
      ...ctx,
      sourceOverrides: { 'navigation.speedOverGround': 'made-up.9' },
    });
    expect(sogBinding(result)?.source).toBe('made-up.9');
    expect(result.satisfied.flatMap((w) => w.notes).join(' ')).toContain(
      'not among the reported sources',
    );
  });

  it('leaves paths without an override on the default source', () => {
    const result = resolveTemplate(mustGet('general'), {
      ...ctx,
      sourceOverrides: { 'navigation.speedOverGround': 'gps.1' },
    });
    const others = result.satisfied
      .flatMap((w) => w.bindings)
      .filter((b) => !b.path.endsWith('speedOverGround'));
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((b) => b.source === 'default')).toBe(true);
  });

  it('notes a source override that no widget bound (typo or unbound path)', () => {
    const result = resolveTemplate(mustGet('general'), {
      ...ctx,
      sourceOverrides: { 'navigation.speedOverGround': 'gps.1', 'made.up.path': 'x.0' },
    });
    expect(result.notes).toContain(
      'source override for "made.up.path" was not applied (path not bound in this dashboard)',
    );
    // The override that DID bind is not flagged as unapplied.
    expect(result.notes.join(' ')).not.toContain('navigation.speedOverGround');
  });
});

describe('resolveTemplate datachart source override', () => {
  const sog = {
    path: 'navigation.speedOverGround',
    skUnit: 'm/s',
    description: null,
    displayName: null,
    hasZones: false,
    pathType: 'number',
    sampleValue: 5,
    sourceCount: 2,
    sources: ['gps.0', 'gps.1'],
    defaultSource: 'gps.0',
  };
  const tmpl: DashboardTemplate = {
    id: 'x',
    name: 'X',
    icon: 'dashboard-dashboard',
    widgets: [
      { selector: 'widget-data-chart', dataChart: { candidates: ['navigation.speedOverGround'] } },
    ],
  };
  const base: ResolveContext = {
    schema,
    inventory: [sog],
    plugins: [],
    capabilities: deriveCapabilities([sog]),
  };

  it('defaults the chart source when no override is given', () => {
    expect(resolveTemplate(tmpl, base).satisfied[0]?.dataChart?.source).toBe('default');
  });

  it('binds the chosen source on the data chart', () => {
    const result = resolveTemplate(tmpl, {
      ...base,
      sourceOverrides: { 'navigation.speedOverGround': 'gps.1' },
    });
    expect(result.satisfied[0]?.dataChart?.source).toBe('gps.1');
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

  it('applies a source override to a paths-array control', () => {
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
      sourceOverrides: { 'electrical.switches.nav.state': 'n2k.5' },
    };
    const result = resolveTemplate(tmpl, localCtx);
    expect(result.satisfied[0].pathControls?.[0].source).toBe('n2k.5');
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
