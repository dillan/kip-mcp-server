import { loadBundledSchema } from '../schema/kip-schema.js';
import { buildKipConfig, validateConfigForWrite, type KipConfig } from './config-builder.js';

const schema = loadBundledSchema();
const dash = { id: 'd1', name: 'X', icon: 'dashboard-dashboard', collapseSplitShell: false, configuration: [] };

describe('buildKipConfig', () => {
  it('builds a complete config stamped with the schema config version', () => {
    const config = buildKipConfig(schema, [dash]);
    expect(config.app.configVersion).toBe(12);
    expect(config.app.dataSets).toEqual([]);
    expect(Object.keys(config.app.unitDefaults as object).length).toBeGreaterThan(5);
    expect(config.app.notificationConfig).toBeDefined();
    expect(config.theme.themeName).toBe('');
    expect(config.dashboards).toEqual([dash]);
  });

  it('applies a theme and unit overrides', () => {
    const config = buildKipConfig(schema, [dash], { theme: 'light-theme', units: { Speed: 'kph' } });
    expect(config.theme.themeName).toBe('light-theme');
    expect((config.app.unitDefaults as Record<string, string>).Speed).toBe('kph');
  });

  it('preserves a base config app/theme but forces the config version', () => {
    const base: KipConfig = {
      app: { configVersion: 99, foo: 'bar', dataSets: [], unitDefaults: { Speed: 'mph' }, notificationConfig: {} },
      theme: { themeName: 'night-theme' },
      dashboards: [],
    };
    const config = buildKipConfig(schema, [dash], { baseConfig: base });
    expect(config.app.configVersion).toBe(12);
    expect(config.app.foo).toBe('bar');
    expect(config.theme.themeName).toBe('night-theme');
    expect(config.dashboards).toEqual([dash]);
  });
});

describe('validateConfigForWrite', () => {
  it('passes a built config', () => {
    expect(validateConfigForWrite(buildKipConfig(schema, [dash]), 12).ok).toBe(true);
  });

  it('fails when the app block is incomplete', () => {
    const bad = { app: { configVersion: 12 }, theme: { themeName: '' }, dashboards: [] };
    expect(validateConfigForWrite(bad, 12).ok).toBe(false);
  });

  it('fails when the config version is wrong', () => {
    const config = buildKipConfig(schema, [dash]);
    config.app.configVersion = 11;
    expect(validateConfigForWrite(config, 12).ok).toBe(false);
  });
});
