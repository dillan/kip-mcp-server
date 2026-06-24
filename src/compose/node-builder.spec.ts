import { loadBundledSchema } from '../schema/kip-schema.js';
import type { WidgetSchemaEntry } from '../schema/schema-types.js';
import { getWidgetSchema } from '../vocabulary.js';
import { buildWidgetNode } from './node-builder.js';

const schema = loadBundledSchema();
const numeric = getWidgetSchema(schema, 'widget-numeric') as WidgetSchemaEntry;
const dataChart = getWidgetSchema(schema, 'widget-data-chart') as WidgetSchemaEntry;
const booleanSwitch = getWidgetSchema(schema, 'widget-boolean-switch') as WidgetSchemaEntry;
const zonesPanel = getWidgetSchema(schema, 'widget-zones-state-panel') as WidgetSchemaEntry;

interface ConfigView {
  paths?: Record<string, { path?: string; convertUnitTo?: string; source?: string }>;
  color?: string;
  displayName?: string;
  datachartPath?: string;
  convertUnitTo?: string;
}

interface PathsArrayView {
  paths: Array<{
    path: string;
    pathType: string;
    pathID: string;
    zonesOnlyPaths: boolean;
    supportsPut: boolean;
    source: string;
    isPathConfigurable: boolean;
    sampleTime: number;
  }>;
  multiChildCtrls: Array<{
    ctrlLabel: string;
    type: string;
    pathID: string;
    color: string;
    isNumeric: boolean;
  }>;
}

describe('buildWidgetNode', () => {
  it('produces a byte-compatible node with matching id and uuid', () => {
    const node = buildWidgetNode({
      widget: numeric,
      uuid: 'u1',
      position: { x: 0, y: 0, w: 4, h: 6 },
      color: 'blue',
      bindings: [
        {
          slot: 'numericPath',
          path: 'self.environment.depth.belowTransducer',
          convertUnitTo: 'm',
          pathSkUnitsFilter: 'm',
        },
      ],
    });

    expect(node.id).toBe('u1');
    expect(node.input.widgetProperties.uuid).toBe('u1');
    expect(node.selector).toBe('widget-host2');
    expect(node.input.widgetProperties.type).toBe('widget-numeric');
    expect({ w: node.w, h: node.h, x: node.x, y: node.y }).toEqual({ w: 4, h: 6, x: 0, y: 0 });

    const config = node.input.widgetProperties.config as ConfigView;
    expect(config.paths?.numericPath?.path).toBe('self.environment.depth.belowTransducer');
    expect(config.paths?.numericPath?.convertUnitTo).toBe('m');
    expect(config.color).toBe('blue');
    expect(config.displayName).toBe(numeric.defaultConfig.displayName);
  });

  it('does not mutate the widget default config', () => {
    const before = JSON.stringify(numeric.defaultConfig);
    buildWidgetNode({
      widget: numeric,
      uuid: 'u2',
      position: { x: 0, y: 0, w: 4, h: 6 },
      bindings: [{ slot: 'numericPath', path: 'self.x' }],
    });
    expect(JSON.stringify(numeric.defaultConfig)).toBe(before);
  });

  it('writes a top-level datachartPath for datachart widgets', () => {
    const node = buildWidgetNode({
      widget: dataChart,
      uuid: 'u3',
      position: { x: 0, y: 0, w: 8, h: 12 },
      dataChart: { path: 'self.environment.wind.speedTrue', convertUnitTo: 'knots' },
    });
    const config = node.input.widgetProperties.config as ConfigView;
    expect(config.datachartPath).toBe('self.environment.wind.speedTrue');
    expect(config.convertUnitTo).toBe('knots');
  });

  it('binds a paths-array switch widget, linking the control to its path entry', () => {
    let n = 0;
    const node = buildWidgetNode({
      widget: booleanSwitch,
      uuid: 'sw',
      position: { x: 0, y: 0, w: 4, h: 4 },
      pathControls: [
        { ctrlLabel: 'Nav Lights', path: 'self.electrical.switches.nav.state', kind: 'switch' },
      ],
      genId: () => `id-${n++}`,
    });
    const cfg = node.input.widgetProperties.config as unknown as PathsArrayView;
    expect(Array.isArray(cfg.paths)).toBe(true);
    expect(cfg.paths).toHaveLength(1);
    expect(cfg.multiChildCtrls).toHaveLength(1);
    expect(cfg.paths[0].pathID).toBe(cfg.multiChildCtrls[0].pathID);
    expect(cfg.paths[0].path).toBe('self.electrical.switches.nav.state');
    expect(cfg.paths[0].pathType).toBe('boolean');
    expect(cfg.paths[0].supportsPut).toBe(true);
    expect(cfg.paths[0].source).toBe('default');
    expect(cfg.paths[0].sampleTime).toBe(500);
    expect(cfg.multiChildCtrls[0].type).toBe('1');
    expect(cfg.multiChildCtrls[0].isNumeric).toBe(false);
  });

  it('binds a paths-array zones widget with the numeric/zones invariants', () => {
    const node = buildWidgetNode({
      widget: zonesPanel,
      uuid: 'z',
      position: { x: 0, y: 0, w: 4, h: 4 },
      pathControls: [
        { ctrlLabel: 'Engine Temp', path: 'self.propulsion.port.temperature', kind: 'zones' },
      ],
      genId: () => 'zid',
    });
    const cfg = node.input.widgetProperties.config as unknown as PathsArrayView;
    expect(cfg.paths[0].pathType).toBe('number');
    expect(cfg.paths[0].zonesOnlyPaths).toBe(true);
    expect(cfg.paths[0].supportsPut).toBe(false);
    expect(cfg.multiChildCtrls[0].type).toBe('4');
    expect(cfg.multiChildCtrls[0].isNumeric).toBe(true);
  });

  it('keeps each path entry index aligned with its control via a shared pathID', () => {
    let n = 0;
    const node = buildWidgetNode({
      widget: booleanSwitch,
      uuid: 'sw2',
      position: { x: 0, y: 0, w: 4, h: 6 },
      pathControls: [
        { ctrlLabel: 'A', path: 'self.electrical.switches.a.state', kind: 'switch' },
        { ctrlLabel: 'B', path: 'self.electrical.switches.b.state', kind: 'switch' },
      ],
      genId: () => `id-${n++}`,
    });
    const cfg = node.input.widgetProperties.config as unknown as PathsArrayView;
    expect(cfg.paths.map((p) => p.pathID)).toEqual(cfg.multiChildCtrls.map((c) => c.pathID));
    expect(cfg.paths[0].pathID).not.toBe(cfg.paths[1].pathID);
  });
});
