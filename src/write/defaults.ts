/**
 * Complete default `app` and notification config for a KIP config.
 *
 * KIP dereferences `app.dataSets`, `app.unitDefaults` and `app.notificationConfig`
 * with no null guard when it loads a config, so any config written for KIP MUST
 * carry a complete `app` block or KIP crashes on load. These defaults mirror KIP's
 * own blank-config defaults.
 */

export const DEFAULT_UNIT_DEFAULTS: Record<string, string> = {
  Unitless: 'unitless',
  Speed: 'knots',
  Flow: 'l/h',
  'Fuel Distance': 'nm/l',
  'Energy Distance': 'nm/kWh',
  Temperature: 'celsius',
  Length: 'm',
  Volume: 'liter',
  Current: 'A',
  Potential: 'V',
  Charge: 'C',
  Power: 'W',
  Energy: 'J',
  Pressure: 'mmHg',
  Density: 'kg/m3',
  Time: 'Hours',
  'Angular Velocity': 'deg/min',
  Angle: 'deg',
  Frequency: 'Hz',
  Ratio: 'ratio',
  Resistance: 'ohm',
};

export const DEFAULT_NOTIFICATION_CONFIG = {
  disableNotifications: false,
  menuGrouping: true,
  security: { disableSecurity: true },
  devices: { disableDevices: false, showNormalState: false, showNominalState: false },
  sound: {
    disableSound: false,
    muteNormal: true,
    muteNominal: true,
    muteWarn: false,
    muteAlert: false,
    muteAlarm: false,
    muteEmergency: false,
  },
};

/** Builds a complete default `app` block stamped with the given config version. */
export function makeDefaultApp(configVersion: number): Record<string, unknown> {
  return {
    configVersion,
    autoNightMode: false,
    redNightMode: false,
    nightModeBrightness: 0.27,
    isRemoteControl: false,
    instanceName: '',
    dataSets: [],
    unitDefaults: { ...DEFAULT_UNIT_DEFAULTS },
    notificationConfig: structuredClone(DEFAULT_NOTIFICATION_CONFIG),
  };
}
