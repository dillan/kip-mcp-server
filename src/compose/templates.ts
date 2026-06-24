/**
 * Dashboard templates: an intent mapped to an ordered list of desired widgets.
 *
 * Each widget names candidate Signal K paths (bare, without the `self.` prefix)
 * for its data slots, a preferred display unit, a colour and a size hint. The
 * resolver binds these against a boat's real data and drops what can't be satisfied.
 *
 * Slot keys (numericPath, gaugePath, headingPath, ...) match KIP's widget
 * DEFAULT_CONFIG. Widgets with good default paths (position, wind-steer) need only
 * be included; their required paths are checked against the inventory.
 */

export type CapabilityGate =
  | 'position'
  | 'speed'
  | 'heading'
  | 'wind'
  | 'depth'
  | 'environment'
  | 'electrical'
  | 'battery'
  | 'engine'
  | 'autopilot';

export interface DesiredSlot {
  slot: string;
  candidates: string[];
  preferredUnit?: string;
}

export interface DesiredWidget {
  selector: string;
  color?: string;
  size?: { w: number; h: number };
  slots?: DesiredSlot[];
  dataChart?: { candidates: string[]; preferredUnit?: string };
  requiredPlugins?: string[];
  anyOfPlugins?: string[];
  capabilityGate?: CapabilityGate;
  group?: string;
  needsManualConfig?: boolean;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  icon: string;
  widgets: DesiredWidget[];
}

const SOG: DesiredSlot = {
  slot: 'numericPath',
  candidates: ['navigation.speedOverGround'],
  preferredUnit: 'knots',
};
const DEPTH: DesiredSlot = {
  slot: 'numericPath',
  candidates: ['environment.depth.belowTransducer'],
  preferredUnit: 'm',
};
const WIND_SPEED: DesiredSlot = {
  slot: 'numericPath',
  candidates: ['environment.wind.speedApparent', 'environment.wind.speedTrue'],
  preferredUnit: 'knots',
};

export const TEMPLATES: DashboardTemplate[] = [
  {
    id: 'general',
    name: 'Overview',
    icon: 'dashboard-dashboard',
    widgets: [
      { selector: 'widget-position', color: 'contrast', capabilityGate: 'position', group: 'nav' },
      {
        selector: 'widget-numeric',
        color: 'contrast',
        slots: [SOG],
        capabilityGate: 'speed',
        group: 'nav',
      },
      {
        selector: 'widget-numeric',
        color: 'contrast',
        slots: [DEPTH],
        capabilityGate: 'depth',
        group: 'nav',
      },
      {
        selector: 'widget-gauge-ng-compass',
        color: 'contrast',
        capabilityGate: 'heading',
        slots: [
          {
            slot: 'gaugePath',
            candidates: ['navigation.headingTrue', 'navigation.headingMagnetic'],
            preferredUnit: 'deg',
          },
        ],
        group: 'nav',
      },
      {
        selector: 'widget-numeric',
        color: 'blue',
        slots: [WIND_SPEED],
        capabilityGate: 'wind',
        group: 'wind',
      },
    ],
  },
  {
    id: 'navigation',
    name: 'Navigation',
    icon: 'dashboard-compass2',
    widgets: [
      {
        selector: 'widget-gauge-ng-compass',
        color: 'contrast',
        capabilityGate: 'heading',
        slots: [
          {
            slot: 'gaugePath',
            candidates: ['navigation.headingTrue', 'navigation.headingMagnetic'],
            preferredUnit: 'deg',
          },
        ],
        size: { w: 8, h: 8 },
      },
      { selector: 'widget-numeric', color: 'contrast', slots: [SOG], capabilityGate: 'speed' },
      { selector: 'widget-position', color: 'contrast', capabilityGate: 'position' },
      { selector: 'widget-numeric', color: 'contrast', slots: [DEPTH], capabilityGate: 'depth' },
    ],
  },
  {
    id: 'sailing',
    name: 'Sailing',
    icon: 'dashboard-sailing',
    widgets: [
      {
        selector: 'widget-wind-steer',
        color: 'contrast',
        capabilityGate: 'wind',
        size: { w: 10, h: 20 },
        slots: [
          {
            slot: 'headingPath',
            candidates: ['navigation.headingTrue', 'navigation.headingMagnetic'],
            preferredUnit: 'deg',
          },
          {
            slot: 'appWindAngle',
            candidates: ['environment.wind.angleApparent'],
            preferredUnit: 'deg',
          },
          {
            slot: 'appWindSpeed',
            candidates: ['environment.wind.speedApparent'],
            preferredUnit: 'knots',
          },
        ],
        group: 'wind',
      },
      {
        selector: 'widget-numeric',
        color: 'contrast',
        slots: [SOG],
        capabilityGate: 'speed',
        group: 'nav',
      },
      // Heel needs attitude.roll; dropped on boats without it.
      { selector: 'widget-heel-gauge', color: 'contrast', group: 'nav' },
    ],
  },
  {
    id: 'power',
    name: 'Power',
    icon: 'dashboard-solar-console',
    widgets: [
      {
        selector: 'widget-bms',
        color: 'contrast',
        capabilityGate: 'battery',
        size: { w: 6, h: 6 },
        needsManualConfig: true,
        group: 'batt',
      },
      {
        selector: 'widget-numeric',
        color: 'contrast',
        slots: [
          {
            slot: 'numericPath',
            candidates: ['electrical.batteries.house.voltage'],
            preferredUnit: 'V',
          },
        ],
        group: 'batt',
      },
      {
        selector: 'widget-numeric',
        color: 'contrast',
        slots: [
          {
            slot: 'numericPath',
            candidates: ['electrical.batteries.house.current'],
            preferredUnit: 'A',
          },
        ],
        group: 'batt',
      },
      {
        selector: 'widget-gauge-ng-radial',
        color: 'green',
        slots: [
          {
            slot: 'gaugePath',
            candidates: ['electrical.batteries.house.stateOfCharge'],
            preferredUnit: 'percent',
          },
        ],
        group: 'batt',
      },
    ],
  },
  {
    id: 'environment',
    name: 'Environment',
    icon: 'dashboard-weather',
    widgets: [
      {
        selector: 'widget-numeric',
        color: 'contrast',
        slots: [
          {
            slot: 'numericPath',
            candidates: ['environment.outside.temperature'],
            preferredUnit: 'celsius',
          },
        ],
        capabilityGate: 'environment',
      },
      {
        selector: 'widget-numeric',
        color: 'contrast',
        slots: [
          {
            slot: 'numericPath',
            candidates: ['environment.outside.pressure'],
            preferredUnit: 'mbar',
          },
        ],
        capabilityGate: 'environment',
      },
      { selector: 'widget-numeric', color: 'blue', slots: [WIND_SPEED], capabilityGate: 'wind' },
    ],
  },
];

export function getTemplate(id: string): DashboardTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
