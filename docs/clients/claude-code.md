# Claude Code

Add the server from your terminal, using the full path to your built `dist/index.js`:

```bash
claude mcp add kip \
  -e SIGNALK_HOST=your-boat \
  -e SIGNALK_PORT=3000 \
  -- node /Users/you/kip-mcp-server/dist/index.js
```

Then start `claude` and ask: *"Look at my boat's data and suggest some KIP dashboards."*

To let it **save** dashboards to the boat, add `-e SIGNALK_TOKEN=your-token`. Without a
token it can still produce a `KipConfig.json` file for you to import in KIP.

Check it's connected with `claude mcp list`.
