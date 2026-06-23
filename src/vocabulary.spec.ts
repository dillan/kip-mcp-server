import { loadBundledSchema } from './schema/kip-schema.js';
import { getDesignSystem, getUnitOptions, getWidgetSchema, listWidgets } from './vocabulary.js';

const schema = loadBundledSchema();

describe('listWidgets', () => {
  it('lists the whole catalog with summary fields', () => {
    const widgets = listWidgets(schema);
    expect(widgets.length).toBe(schema.widgets.length);
    const numeric = widgets.find((w) => w.selector === 'widget-numeric');
    expect(numeric).toMatchObject({ name: 'Numeric', category: 'Core', bindingKind: 'paths-record' });
  });

  it('filters by category', () => {
    const gauges = listWidgets(schema, { category: 'Gauge' });
    expect(gauges.length).toBeGreaterThan(0);
    expect(gauges.every((w) => w.category === 'Gauge')).toBe(true);
  });

  it('filters to widgets that need no plugins', () => {
    const standalone = listWidgets(schema, { requiresNoPlugins: true });
    expect(standalone.every((w) => w.requiredPlugins.length === 0 && !w.anyOfPlugins?.length)).toBe(true);
    expect(standalone.some((w) => w.selector === 'widget-freeboardsk')).toBe(false);
  });
});

describe('getWidgetSchema', () => {
  it('returns the full entry with default config and path slots', () => {
    const numeric = getWidgetSchema(schema, 'widget-numeric');
    expect(numeric?.defaultConfig).toBeTypeOf('object');
    expect(numeric?.pathSlots.some((s) => s.slot === 'numericPath')).toBe(true);
  });

  it('returns undefined for an unknown selector', () => {
    expect(getWidgetSchema(schema, 'widget-nope')).toBeUndefined();
  });
});

describe('getDesignSystem', () => {
  it('returns the design system', () => {
    expect(getDesignSystem(schema).grid.column).toBe(24);
    expect(getDesignSystem(schema).colors.length).toBe(8);
  });
});

describe('getUnitOptions', () => {
  it('finds the group and measures for a Signal K base unit', () => {
    const angle = getUnitOptions(schema, 'rad');
    expect(angle?.group).toBe('Angle');
    expect(angle?.measures.map((m) => m.measure)).toEqual(expect.arrayContaining(['deg', 'rad']));

    const speed = getUnitOptions(schema, 'm/s');
    expect(speed?.group).toBe('Speed');
    expect(speed?.measures.map((m) => m.measure)).toContain('knots');
  });

  it('returns null for a unit in no group', () => {
    expect(getUnitOptions(schema, 'not-a-unit')).toBeNull();
  });
});
