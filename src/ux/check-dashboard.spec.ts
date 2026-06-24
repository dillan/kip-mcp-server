import { checkDashboardUx } from './check-dashboard.js';

type PathCfg = { path: string; convertUnitTo?: string; source?: string };
function node(opts: {
  type?: string;
  name?: string | null;
  decimals?: number | null;
  paths?: PathCfg[];
  pos?: { x: number; y: number; w: number; h: number };
}): unknown {
  const config: Record<string, unknown> = {};
  if (opts.name !== undefined && opts.name !== null) config.displayName = opts.name;
  if (typeof opts.decimals === 'number') config.numDecimal = opts.decimals;
  if (opts.paths?.length) {
    config.paths = Object.fromEntries(opts.paths.map((p, i) => [`slot${i}`, p]));
  }
  const n: Record<string, unknown> = {
    input: { widgetProperties: { type: opts.type ?? 'widget-numeric', config } },
  };
  if (opts.pos) Object.assign(n, opts.pos);
  return n;
}
const dash = (...nodes: unknown[]) => ({ configuration: nodes });
const cell = { x: 0, y: 0, w: 2, h: 2 };

describe('checkDashboardUx', () => {
  it('passes a clean config', () => {
    const r = checkDashboardUx(
      dash(
        node({
          name: 'DPT',
          decimals: 1,
          paths: [{ path: 'self.environment.depth.belowTransducer', convertUnitTo: 'm' }],
          pos: cell,
        }),
      ),
    );
    expect(r.ok).toBe(true);
    expect(r.summary).toMatch(/No objective/);
  });

  it('flags a raw Signal K path used as a label', () => {
    const r = checkDashboardUx(
      dash(
        node({
          name: 'environment.wind.angleApparent',
          paths: [{ path: 'self.environment.wind.angleApparent' }],
          pos: cell,
        }),
      ),
    );
    expect(r.ok).toBe(false);
    expect(r.rawPathLabels).toEqual([
      {
        widget: 'node[0] (widget-numeric)',
        label: 'environment.wind.angleApparent',
        issue: 'raw-path',
      },
    ]);
  });

  it('flags a missing label on a data widget', () => {
    const r = checkDashboardUx(
      dash(node({ name: null, paths: [{ path: 'self.navigation.speedOverGround' }], pos: cell })),
    );
    expect(r.rawPathLabels[0]).toMatchObject({ issue: 'missing' });
  });

  it('flags the same path bound by two widgets', () => {
    const r = checkDashboardUx(
      dash(
        node({ name: 'A', paths: [{ path: 'self.navigation.speedOverGround' }], pos: cell }),
        node({
          name: 'B',
          paths: [{ path: 'self.navigation.speedOverGround' }],
          pos: { x: 2, y: 0, w: 2, h: 2 },
        }),
      ),
    );
    expect(r.duplicatePaths).toEqual([
      {
        path: 'navigation.speedOverGround',
        widgets: ['node[0] (widget-numeric) "A"', 'node[1] (widget-numeric) "B"'],
      },
    ]);
  });

  it('flags overlapping grid cells', () => {
    const r = checkDashboardUx(
      dash(
        node({ name: 'A', paths: [{ path: 'self.x.a' }], pos: { x: 0, y: 0, w: 3, h: 3 } }),
        node({ name: 'B', paths: [{ path: 'self.x.b' }], pos: { x: 1, y: 1, w: 3, h: 3 } }),
      ),
    );
    expect(r.overlappingCells).toHaveLength(1);
    expect(r.overlappingCells[0].widgets).toHaveLength(2);
  });

  it('does not flag adjacent (non-overlapping) cells', () => {
    const r = checkDashboardUx(
      dash(
        node({ name: 'A', paths: [{ path: 'self.x.a' }], pos: { x: 0, y: 0, w: 2, h: 2 } }),
        node({ name: 'B', paths: [{ path: 'self.x.b' }], pos: { x: 2, y: 0, w: 2, h: 2 } }),
      ),
    );
    expect(r.overlappingCells).toHaveLength(0);
  });

  it('flags mixed units within a quantity (depth in m and ft)', () => {
    const r = checkDashboardUx(
      dash(
        node({
          name: 'DPT',
          decimals: 1,
          paths: [{ path: 'self.environment.depth.belowTransducer', convertUnitTo: 'm' }],
          pos: cell,
        }),
        node({
          name: 'DBK',
          decimals: 1,
          paths: [{ path: 'self.environment.depth.belowKeel', convertUnitTo: 'feet' }],
          pos: { x: 2, y: 0, w: 2, h: 2 },
        }),
      ),
    );
    expect(r.mixedUnits).toHaveLength(1);
    expect(r.mixedUnits[0].quantity).toBe('depth');
    expect(r.mixedUnits[0].units.map((u) => u.unit).sort()).toEqual(['feet', 'm']);
  });

  it('flags inconsistent precision within a quantity', () => {
    const r = checkDashboardUx(
      dash(
        node({
          name: 'DPT',
          decimals: 0,
          paths: [{ path: 'self.environment.depth.belowTransducer', convertUnitTo: 'm' }],
          pos: cell,
        }),
        node({
          name: 'DBK',
          decimals: 1,
          paths: [{ path: 'self.environment.depth.belowKeel', convertUnitTo: 'm' }],
          pos: { x: 2, y: 0, w: 2, h: 2 },
        }),
      ),
    );
    expect(r.inconsistentPrecision).toHaveLength(1);
    expect(r.inconsistentPrecision[0].quantity).toBe('depth');
  });

  it('does not cross quantity boundaries (depth-m and speed-knots are fine)', () => {
    const r = checkDashboardUx(
      dash(
        node({
          name: 'DPT',
          decimals: 1,
          paths: [{ path: 'self.environment.depth.belowTransducer', convertUnitTo: 'm' }],
          pos: cell,
        }),
        node({
          name: 'SOG',
          decimals: 1,
          paths: [{ path: 'self.navigation.speedOverGround', convertUnitTo: 'knots' }],
          pos: { x: 2, y: 0, w: 2, h: 2 },
        }),
      ),
    );
    expect(r.mixedUnits).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it('does not flag a missing label on self-labeling SVG widgets', () => {
    const r = checkDashboardUx(
      dash(
        node({
          type: 'widget-wind-steer',
          name: null,
          paths: [
            { path: 'self.environment.wind.angleApparent' },
            { path: 'self.environment.wind.angleTrue' },
          ],
          pos: cell,
        }),
      ),
    );
    expect(r.rawPathLabels).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it('still flags a missing label on a value-display widget', () => {
    const r = checkDashboardUx(
      dash(
        node({
          type: 'widget-numeric',
          name: null,
          paths: [{ path: 'self.navigation.speedOverGround' }],
          pos: cell,
        }),
      ),
    );
    expect(r.rawPathLabels[0]).toMatchObject({ issue: 'missing' });
  });

  it('treats the same path from different sources as not a duplicate', () => {
    const r = checkDashboardUx(
      dash(
        node({
          name: 'DPT port',
          paths: [{ path: 'self.environment.depth.belowTransducer', source: 'port' }],
          pos: cell,
        }),
        node({
          name: 'DPT stbd',
          paths: [{ path: 'self.environment.depth.belowTransducer', source: 'stbd' }],
          pos: { x: 2, y: 0, w: 2, h: 2 },
        }),
      ),
    );
    expect(r.duplicatePaths).toHaveLength(0);
  });

  it('flags the same path AND source bound by two widgets', () => {
    const r = checkDashboardUx(
      dash(
        node({
          name: 'A',
          paths: [{ path: 'self.environment.depth.belowTransducer', source: 'port' }],
          pos: cell,
        }),
        node({
          name: 'B',
          paths: [{ path: 'self.environment.depth.belowTransducer', source: 'port' }],
          pos: { x: 2, y: 0, w: 2, h: 2 },
        }),
      ),
    );
    expect(r.duplicatePaths).toHaveLength(1);
  });

  it('does not attribute a multi-quantity widget precision to a quantity', () => {
    const r = checkDashboardUx(
      dash(
        node({
          name: 'Combo',
          decimals: 2,
          paths: [
            { path: 'self.environment.depth.belowTransducer', convertUnitTo: 'm' },
            { path: 'self.environment.water.temperature', convertUnitTo: 'celsius' },
          ],
          pos: cell,
        }),
        node({
          name: 'SST',
          decimals: 0,
          paths: [{ path: 'self.environment.outside.temperature', convertUnitTo: 'celsius' }],
          pos: { x: 2, y: 0, w: 2, h: 2 },
        }),
      ),
    );
    expect(r.inconsistentPrecision).toHaveLength(0);
  });

  it('tolerates an empty or malformed config', () => {
    expect(checkDashboardUx({}).ok).toBe(true);
    expect(checkDashboardUx(null).ok).toBe(true);
    expect(checkDashboardUx({ configuration: 'nope' }).ok).toBe(true);
    expect(checkDashboardUx({ configuration: [null, 42, {}] }).ok).toBe(true);
  });
});
