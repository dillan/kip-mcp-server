import { readFileSync } from 'node:fs';
import { composeDashboard } from './compose/dashboard-builder.js';
import { getTemplate, type DashboardTemplate } from './compose/templates.js';
import { deriveCapabilities, flattenVesselData } from './discovery/inventory.js';
import { loadBundledSchema } from './schema/kip-schema.js';
import type { ResolveContext } from './compose/resolver.js';
import { validateDashboard } from './validators.js';

const schema = loadBundledSchema();
const self = JSON.parse(
  readFileSync(new URL('./discovery/fixtures/sailboat-self.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const inventory = flattenVesselData(self);
const ctx: ResolveContext = { schema, inventory, plugins: [], capabilities: deriveCapabilities(inventory) };

let counter = 0;
const uuid = (): string => `u${(counter += 1)}`;
const template = (id: string): DashboardTemplate => {
  const t = getTemplate(id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};

interface NodeOpts {
  id?: string;
  uuid?: string;
  selector?: string;
  type?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  config?: Record<string, unknown>;
}

function makeNode(o: NodeOpts = {}): unknown {
  const id = o.id ?? 'n1';
  return {
    w: o.w ?? 4,
    h: o.h ?? 6,
    x: o.x ?? 0,
    y: o.y ?? 0,
    id,
    selector: o.selector ?? 'widget-host2',
    input: {
      widgetProperties: { type: o.type ?? 'widget-numeric', uuid: o.uuid ?? id, config: o.config ?? {} },
    },
  };
}

const dash = (nodes: unknown[]): unknown => ({
  id: 'd1',
  name: 'Test',
  icon: 'dashboard-dashboard',
  collapseSplitShell: false,
  configuration: nodes,
});

describe('validateDashboard', () => {
  it('passes a generated dashboard with no errors (golden)', () => {
    counter = 0;
    const { dashboard } = composeDashboard(template('general'), ctx, uuid);
    const result = validateDashboard(dashboard, schema);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('accepts datachart top-level convertUnitTo and unknown extra config keys', () => {
    const node = makeNode({
      type: 'widget-data-chart',
      id: 'dc',
      w: 8,
      h: 12,
      config: { datachartPath: 'self.environment.wind.speedTrue', convertUnitTo: 'knots', invertData: true },
    });
    expect(validateDashboard(dash([node]), schema).errors).toEqual([]);
  });

  it('errors on a wrong selector', () => {
    const result = validateDashboard(dash([makeNode({ selector: 'host' })]), schema);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/widget-host2/);
  });

  it('errors when node id does not match widgetProperties.uuid', () => {
    const result = validateDashboard(dash([makeNode({ id: 'a', uuid: 'b' })]), schema);
    expect(result.errors.join(' ')).toMatch(/uuid/i);
  });

  it('errors on an unknown widget type', () => {
    const result = validateDashboard(dash([makeNode({ type: 'widget-nope' })]), schema);
    expect(result.errors.join(' ')).toMatch(/unknown widget type/i);
  });

  it('errors when a node exceeds the grid width', () => {
    const result = validateDashboard(dash([makeNode({ x: 20, w: 8 })]), schema);
    expect(result.errors.join(' ')).toMatch(/column/i);
  });

  it('errors when nodes overlap', () => {
    const result = validateDashboard(
      dash([makeNode({ id: 'a' }), makeNode({ id: 'b', x: 2, y: 2 })]),
      schema,
    );
    expect(result.errors.join(' ')).toMatch(/overlap/i);
  });
});
