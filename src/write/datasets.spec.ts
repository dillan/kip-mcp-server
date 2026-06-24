import { deriveDataSets } from './datasets.js';

function dataChartNode(uuid: string, config: Record<string, unknown>): unknown {
  return {
    id: uuid,
    selector: 'widget-host2',
    input: { widgetProperties: { type: 'widget-data-chart', uuid, config } },
  };
}

const dashboard = (...nodes: unknown[]): unknown => ({ id: 'd1', configuration: nodes });

describe('deriveDataSets', () => {
  it('creates one entry per data-chart widget, keyed by the widget uuid', () => {
    const sets = deriveDataSets([
      dashboard(dataChartNode('w1', { datachartPath: 'environment.outside.temperature' })),
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({
      uuid: 'w1',
      path: 'environment.outside.temperature',
      editable: false,
    });
  });

  it('builds the four-part pathSignature label so KIP keeps the entry', () => {
    const sets = deriveDataSets([
      dashboard(
        dataChartNode('w1', {
          datachartPath: 'navigation.speedOverGround',
          datachartSource: 'gps.0',
          convertUnitTo: 'knots',
          timeScale: 'minute',
          period: 5,
        }),
      ),
    ]);
    expect(sets[0].label).toBe('navigation.speedOverGround|knots|gps.0|minute|5');
    expect(sets[0].pathSource).toBe('gps.0');
    expect(sets[0].timeScaleFormat).toBe('minute');
    expect(sets[0].period).toBe(5);
  });

  it('defaults the source to "default" and uses minute/10 when unset', () => {
    const sets = deriveDataSets([
      dashboard(dataChartNode('w1', { datachartPath: 'navigation.speedOverGround' })),
    ]);
    expect(sets[0].pathSource).toBe('default');
    expect(sets[0].timeScaleFormat).toBe('minute');
    expect(sets[0].period).toBe(10);
  });

  it('ignores non-data-chart widgets and charts without a path', () => {
    const sets = deriveDataSets([
      dashboard(
        {
          id: 'n',
          selector: 'widget-host2',
          input: { widgetProperties: { type: 'widget-numeric', uuid: 'n', config: { paths: {} } } },
        },
        dataChartNode('w2', {}),
      ),
    ]);
    expect(sets).toHaveLength(0);
  });

  it('does not throw on a null or malformed node', () => {
    const sets = deriveDataSets([
      dashboard(null, 'x', dataChartNode('w1', { datachartPath: 'x.y' })),
    ]);
    expect(sets).toHaveLength(1);
  });
});
