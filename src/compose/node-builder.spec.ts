import { loadBundledSchema } from '../schema/kip-schema.js';
import type { WidgetSchemaEntry } from '../schema/schema-types.js';
import { getWidgetSchema } from '../vocabulary.js';
import { buildWidgetNode } from './node-builder.js';

const schema = loadBundledSchema();
const numeric = getWidgetSchema(schema, 'widget-numeric') as WidgetSchemaEntry;
const dataChart = getWidgetSchema(schema, 'widget-data-chart') as WidgetSchemaEntry;

interface ConfigView {
  paths?: Record<string, { path?: string; convertUnitTo?: string; source?: string }>;
  color?: string;
  displayName?: string;
  datachartPath?: string;
  convertUnitTo?: string;
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
});
