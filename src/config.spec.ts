import { ConfigError, describeConfig, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('derives the KIP base URL from the Signal K host and port', () => {
    expect(loadConfig({ SIGNALK_HOST: 'boat.local', SIGNALK_PORT: '3000' }).kipBaseUrl).toBe(
      'http://boat.local:3000/@mxtommy/kip/',
    );
  });

  it('uses https when SIGNALK_TLS is true', () => {
    expect(loadConfig({ SIGNALK_HOST: 'boat.local', SIGNALK_TLS: 'true' }).kipBaseUrl).toBe(
      'https://boat.local:3000/@mxtommy/kip/',
    );
  });

  it('prefers KIP_URL and ensures a trailing slash', () => {
    expect(loadConfig({ KIP_URL: 'http://x/@mxtommy/kip' }).kipBaseUrl).toBe(
      'http://x/@mxtommy/kip/',
    );
  });

  it('defaults the host and port', () => {
    expect(loadConfig({}).kipBaseUrl).toBe('http://localhost:3000/@mxtommy/kip/');
  });

  it('derives the Signal K base URL and passes through a token', () => {
    const config = loadConfig({ SIGNALK_HOST: 'boat.local', SIGNALK_TOKEN: 'jwt-abc' });
    expect(config.signalkBaseUrl).toBe('http://boat.local:3000');
    expect(config.token).toBe('jwt-abc');
  });

  it('reads username and password credentials for login', () => {
    const config = loadConfig({
      SIGNALK_HOST: 'boat.local',
      SIGNALK_USER: 'me',
      SIGNALK_PASSWORD: 'secret',
    });
    expect(config.credentials).toEqual({ username: 'me', password: 'secret' });
  });
});

describe('loadConfig validation', () => {
  it('throws a clear error on a non-numeric port', () => {
    expect(() => loadConfig({ SIGNALK_PORT: 'abc' })).toThrow(ConfigError);
  });

  it('throws on an out-of-range port', () => {
    expect(() => loadConfig({ SIGNALK_PORT: '0' })).toThrow(/port/i);
    expect(() => loadConfig({ SIGNALK_PORT: '70000' })).toThrow(/port/i);
  });

  it('throws on an invalid KIP_URL', () => {
    expect(() => loadConfig({ KIP_URL: 'not a url' })).toThrow(ConfigError);
  });

  it('accepts a valid port and KIP_URL', () => {
    expect(() =>
      loadConfig({ SIGNALK_PORT: '3000', KIP_URL: 'http://x/@mxtommy/kip/' }),
    ).not.toThrow();
  });
});

describe('describeConfig', () => {
  it('summarises the connection and token auth without leaking the secret', () => {
    const summary = describeConfig(
      loadConfig({ SIGNALK_HOST: 'boat', SIGNALK_TOKEN: 'super-secret' }),
    );
    expect(summary).toContain('boat');
    expect(summary).toContain('token');
    expect(summary).not.toContain('super-secret');
  });

  it('reports the username/password and anonymous auth modes', () => {
    expect(describeConfig(loadConfig({ SIGNALK_USER: 'u', SIGNALK_PASSWORD: 'p' }))).toContain(
      'username/password',
    );
    expect(describeConfig(loadConfig({}))).toContain('none');
  });
});
