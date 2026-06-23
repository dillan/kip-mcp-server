/**
 * Turns a Signal K `vessels/self` tree into a flat path inventory and derives
 * capability flags. Pure functions — the network lives in the discovery client.
 */

/** One available Signal K data path with its metadata. */
export interface PathInfo {
  /** Bare path, e.g. `navigation.speedOverGround`. */
  path: string;
  /** Signal K base unit from meta.units, or null. */
  skUnit: string | null;
  description: string | null;
  displayName: string | null;
  hasZones: boolean;
  /** Type of the current value: number | string | boolean | object | array | null. */
  pathType: string;
  sampleValue: unknown;
  /** Number of sources reporting this path (>=1). */
  sourceCount: number;
}

/** High-level "what does this boat have" flags used to pick widgets. */
export interface Capabilities {
  hasPosition: boolean;
  hasSpeed: boolean;
  hasHeading: boolean;
  hasWind: boolean;
  hasDepth: boolean;
  hasEnvironment: boolean;
  hasElectrical: boolean;
  batteryCount: number;
  hasEngine: boolean;
  engineCount: number;
  hasAutopilot: boolean;
}

const RESERVED = new Set(['value', 'values', '$source', 'source', 'timestamp', 'meta', 'pgn', 'sentence']);

function isLeaf(node: Record<string, unknown>): boolean {
  return 'value' in node || 'values' in node || 'meta' in node;
}

function valueType(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function toPathInfo(path: string, node: Record<string, unknown>): PathInfo {
  const meta = (node.meta ?? {}) as Record<string, unknown>;
  const value = 'value' in node ? node.value : null;
  const values = node.values as Record<string, unknown> | undefined;
  const zones = meta.zones;
  return {
    path,
    skUnit: typeof meta.units === 'string' ? meta.units : null,
    description: typeof meta.description === 'string' ? meta.description : null,
    displayName: typeof meta.displayName === 'string' ? meta.displayName : null,
    hasZones: Array.isArray(zones) && zones.length > 0,
    pathType: valueType(value),
    sampleValue: value ?? null,
    sourceCount: values ? Object.keys(values).length : 1,
  };
}

/** Flattens a `vessels/self` tree into a sorted path inventory. */
export function flattenVesselData(self: Record<string, unknown>): PathInfo[] {
  const out: PathInfo[] = [];

  const walk = (node: Record<string, unknown>, prefix: string): void => {
    for (const [key, child] of Object.entries(node)) {
      if (RESERVED.has(key)) continue;
      if (child === null || typeof child !== 'object') continue; // skip bare props like name/mmsi
      const path = prefix ? `${prefix}.${key}` : key;
      const obj = child as Record<string, unknown>;
      if (isLeaf(obj)) {
        out.push(toPathInfo(path, obj));
      } else {
        walk(obj, path);
      }
    }
  };

  walk(self, '');
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** Derives capability flags from a path inventory. */
export function deriveCapabilities(paths: PathInfo[]): Capabilities {
  const list = paths.map((p) => p.path);
  const has = (prefix: string): boolean => list.some((p) => p === prefix || p.startsWith(prefix));
  const instancesUnder = (prefix: string): number =>
    new Set(
      list.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length).split('.')[0]),
    ).size;

  return {
    hasPosition: list.includes('navigation.position'),
    hasSpeed: list.includes('navigation.speedOverGround'),
    hasHeading: has('navigation.heading'),
    hasWind: has('environment.wind.'),
    hasDepth: has('environment.depth.'),
    hasEnvironment: has('environment.outside.'),
    hasElectrical: has('electrical.'),
    batteryCount: instancesUnder('electrical.batteries.'),
    hasEngine: has('propulsion.'),
    engineCount: instancesUnder('propulsion.'),
    hasAutopilot: has('steering.autopilot.'),
  };
}
