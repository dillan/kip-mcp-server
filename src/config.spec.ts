import { loadConfig } from './config.js';

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
    expect(loadConfig({ KIP_URL: 'http://x/@mxtommy/kip' }).kipBaseUrl).toBe('http://x/@mxtommy/kip/');
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
