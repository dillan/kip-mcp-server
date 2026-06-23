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

/** Flattens a `vessels/self` tree into a sorted path inventory. STUB. */
export function flattenVesselData(_self: Record<string, unknown>): PathInfo[] {
  return [];
}

/** Derives capability flags from a path inventory. STUB. */
export function deriveCapabilities(_paths: PathInfo[]): Capabilities {
  return {
    hasPosition: false,
    hasSpeed: false,
    hasHeading: false,
    hasWind: false,
    hasDepth: false,
    hasEnvironment: false,
    hasElectrical: false,
    batteryCount: 0,
    hasEngine: false,
    engineCount: 0,
    hasAutopilot: false,
  };
}
