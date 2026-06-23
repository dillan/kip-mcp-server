import { health, serverName, SERVER_NAME } from '../src/health.js';

describe('health', () => {
  it('reports ok with the server name', () => {
    expect(health()).toEqual({ ok: true, name: 'kip-mcp-server' });
  });

  it('exposes the server name', () => {
    expect(serverName()).toBe(SERVER_NAME);
  });
});
