import type { DiscoveryResult } from './discovery/discover.js';
import type { Capabilities, PathInfo } from './discovery/inventory.js';
import { loadBundledSchema } from './schema/kip-schema.js';
import { validateAgainstSignalk } from './validate-signalk.js';

const schema = loadBundledSchema();

function pathInfo(path: string, skUnit: string | null = null): PathInfo {
  return {
    path,
    skUnit,
    description: null,
    displayName: null,
    hasZones: false,
    pathType: 'number',
    sampleValue: 0,
    sourceCount: 1,
  };
}

function discovery(
  opts: { paths?: PathInfo[]; plugins?: { id: string; enabled: boolean }[] } = {},
): DiscoveryResult {
  return {
    server: { version: '2.13.0' },
    paths: opts.paths ?? [],
    capabilities: {} as Capabilities,
    plugins: opts.plugins ?? [],
  };
}

function numericNode(path: string, pathSkUnitsFilter?: string): unknown {
  const config = {
    paths: { numericPath: { path, ...(pathSkUnitsFilter ? { pathSkUnitsFilter } : {}) } },
  };
  return {
    w: 2,
    h: 2,
    x: 0,
    y: 0,
    id: 'u1',
    selector: 'widget-host2',
    input: { widgetProperties: { type: 'widget-numeric', uuid: 'u1', config } },
  };
}

function widgetNode(type: string, config: Record<string, unknown> = {}): unknown {
  return {
    w: 2,
    h: 2,
    x: 0,
    y: 0,
    id: 'u2',
    selector: 'widget-host2',
    input: { widgetProperties: { type, uuid: 'u2', config } },
  };
}

const dashboard = (...nodes: unknown[]): unknown => ({
  id: 'd1',
  name: 'T',
  icon: 'dashboard-dashboard',
  configuration: nodes,
});

describe('validateAgainstSignalk', () => {
  it('passes when bound paths exist, plugins are enabled and units match', () => {
    const dash = dashboard(numericNode('self.navigation.speedOverGround', 'm/s'));
    const result = validateAgainstSignalk(
      schema,
      dash,
      discovery({ paths: [pathInfo('navigation.speedOverGround', 'm/s')] }),
    );
    expect(result.ok).toBe(true);
    expect(result.missingPaths).toEqual([]);
    expect(result.checkedPaths).toBe(1);
  });

  it('flags a bound path that the boat does not report', () => {
    const dash = dashboard(numericNode('self.navigation.speedOverGround'));
    const result = validateAgainstSignalk(
      schema,
      dash,
      discovery({ paths: [pathInfo('navigation.headingTrue')] }),
    );
    expect(result.ok).toBe(false);
    expect(result.missingPaths.map((m) => m.path)).toContain('self.navigation.speedOverGround');
  });

  it('flags a required plugin that is missing or disabled', () => {
    const dash = dashboard(widgetNode('widget-anchor-alarm'));
    const missing = validateAgainstSignalk(schema, dash, discovery({ plugins: [] }));
    expect(missing.ok).toBe(false);
    expect(missing.pluginIssues).toEqual([
      expect.objectContaining({ plugin: 'anchoralarm', state: 'missing' }),
    ]);

    const disabled = validateAgainstSignalk(
      schema,
      dash,
      discovery({ plugins: [{ id: 'anchoralarm', enabled: false }] }),
    );
    expect(disabled.pluginIssues).toEqual([
      expect.objectContaining({ plugin: 'anchoralarm', state: 'disabled' }),
    ]);
  });

  it('flags a unit mismatch between the binding and the live meta.units', () => {
    const dash = dashboard(numericNode('self.navigation.speedOverGround', 'K'));
    const result = validateAgainstSignalk(
      schema,
      dash,
      discovery({ paths: [pathInfo('navigation.speedOverGround', 'm/s')] }),
    );
    expect(result.ok).toBe(false);
    expect(result.unitMismatches).toEqual([
      expect.objectContaining({ path: 'self.navigation.speedOverGround', declared: 'K', live: 'm/s' }),
    ]);
  });

  it('warns (does not fail) when the live path has no meta.units', () => {
    const dash = dashboard(numericNode('self.navigation.speedOverGround', 'm/s'));
    const result = validateAgainstSignalk(
      schema,
      dash,
      discovery({ paths: [pathInfo('navigation.speedOverGround', null)] }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('warns on an unknown widget type without crashing', () => {
    const dash = dashboard(widgetNode('widget-does-not-exist'));
    const result = validateAgainstSignalk(schema, dash, discovery());
    expect(result.warnings.some((w) => w.includes('widget-does-not-exist'))).toBe(true);
  });

  it('does not throw on a null or non-object node, and warns instead', () => {
    const dash = dashboard(null, 'nope', numericNode('self.navigation.speedOverGround'));
    const result = validateAgainstSignalk(
      schema,
      dash,
      discovery({ paths: [pathInfo('navigation.speedOverGround', 'm/s')] }),
    );
    expect(result.warnings.some((w) => w.includes('not a widget node'))).toBe(true);
    expect(result.checkedPaths).toBe(1);
  });

  it('extracts a paths-array binding (switch panel)', () => {
    const node = widgetNode('widget-boolean-switch', {
      paths: [{ path: 'self.electrical.switches.nav.state' }],
    });
    const result = validateAgainstSignalk(schema, dashboard(node), discovery());
    expect(result.checkedPaths).toBe(1);
    expect(result.missingPaths.map((m) => m.path)).toContain('self.electrical.switches.nav.state');
  });

  it('extracts a datachart binding (top-level datachartPath)', () => {
    const node = widgetNode('widget-data-chart', {
      datachartPath: 'self.environment.outside.temperature',
    });
    const result = validateAgainstSignalk(schema, dashboard(node), discovery());
    expect(result.checkedPaths).toBe(1);
    expect(result.missingPaths.map((m) => m.path)).toContain('self.environment.outside.temperature');
  });

  it("warns when none of a widget's optional (anyOf) plugins are enabled", () => {
    const result = validateAgainstSignalk(
      schema,
      dashboard(widgetNode('widget-autopilot')),
      discovery({ plugins: [] }),
    );
    expect(result.warnings.some((w) => w.includes('autopilot'))).toBe(true);
  });
});
