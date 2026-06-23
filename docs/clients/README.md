# Connecting an AI assistant

Pick your assistant and follow its short guide. They all do the same thing: they start
`kip-mcp-server` and tell it your boat's Signal K address.

- [Claude Desktop](./claude-desktop.md)
- [Claude Code](./claude-code.md)
- [Codex CLI](./codex-cli.md)
- [Gemini CLI](./gemini-cli.md)

## Before you start

Build the server once (see the main [README](../../README.md)):

```bash
npm ci
npm run build
```

Note the full path to `dist/index.js` — you'll point your assistant at it. For example:
`/Users/you/kip-mcp-server/dist/index.js`.

## Settings you'll provide

- `SIGNALK_HOST` — your Signal K host name or IP (e.g. `your-boat`). Default `localhost`.
- `SIGNALK_PORT` — your Signal K port. Default `3000`.
- `SIGNALK_TLS` — `true` if your server uses `https`. Default `false`.
- `SIGNALK_TOKEN` — only needed to **write** dashboards to the boat. Reading needs nothing.
