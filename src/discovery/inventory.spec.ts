import { readFileSync } from 'node:fs';
import { deriveCapabilities, flattenVesselData, type PathInfo } from './inventory.js';

const self = JSON.parse(
  readFileSync(new URL('./fixtures/sailboat-self.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const paths = (): PathInfo[] => flattenVesselData(self);
const find = (p: string): PathInfo | undefined => paths().find((x) => x.path === p);

describe('flattenVesselData', () => {
  it('flattens leaf paths and skips bare vessel properties', () => {
    const list = paths();
    expect(list).toHaveLength(19);
    const names = list.map((p) => p.path);
    expect(names).not.toContain('name');
    expect(names).not.toContain('mmsi');
    // sorted for stable output
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('reads units, description and value type', () => {
    expect(find('navigation.speedOverGround')).toMatchObject({
      skUnit: 'm/s',
      pathType: 'number',
      description: 'Vessel speed over ground',
    });
  });

  it('counts sources from the values map', () => {
    expect(find('navigation.speedOverGround')?.sourceCount).toBe(2);
    expect(find('navigation.headingTrue')?.sourceCount).toBe(1);
  });

  it('flags paths that carry zones metadata', () => {
    expect(find('environment.depth.belowTransducer')?.hasZones).toBe(true);
    expect(find('navigation.speedOverGround')?.hasZones).toBe(false);
  });

  it('reads displayName when present', () => {
    expect(find('navigation.headingTrue')?.displayName).toBe('Heading (True)');
  });
});

describe('deriveCapabilities', () => {
  it('derives the boat capabilities from the inventory', () => {
    expect(deriveCapabilities(paths())).toEqual({
      hasPosition: true,
      hasSpeed: true,
      hasHeading: true,
      hasWind: true,
      hasDepth: true,
      hasEnvironment: true,
      hasElectrical: true,
      batteryCount: 2,
      hasEngine: true,
      engineCount: 1,
      hasAutopilot: true,
    });
  });
});
