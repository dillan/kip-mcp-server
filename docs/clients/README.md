# Connecting an AI assistant

Pick your assistant and follow its short guide. They all do the same thing: they start
`kip-mcp-server` and tell it your boat's Signal K address.

- [Claude Desktop](./claude-desktop.md)
- [Claude Code](./claude-code.md)
- [Codex CLI](./codex-cli.md)
- [Gemini CLI](./gemini-cli.md)

## Before you start

You need [Node.js](https://nodejs.org) 24 or newer. Each guide uses `npx -y kip-mcp-server`,
which downloads and runs the server on demand — there's nothing to install first.

Prefer to run a local build instead of `npx`? Build it once (`npm ci && npm run build`) and
use `node /full/path/to/dist/index.js` wherever a guide says `npx -y kip-mcp-server`. The
[development guide](../development.md) covers local builds, the MCP Inspector, and the HTTP transport.

## Settings you'll provide

- `SIGNALK_HOST` — your Signal K host name or IP (e.g. `your-boat`). Default `localhost`.
- `SIGNALK_PORT` — your Signal K port. Default `3000`.
- `SIGNALK_TLS` — `true` if your server uses `https`. Default `false`.
- `SIGNALK_TOKEN` — only needed to **write** dashboards to the boat. Reading needs nothing.
