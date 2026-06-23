# Gemini CLI

Edit `~/.gemini/settings.json` and add a `kip` server, using the full path to your built
`dist/index.js`:

```json
{
  "mcpServers": {
    "kip": {
      "command": "node",
      "args": ["/Users/you/kip-mcp-server/dist/index.js"],
      "env": {
        "SIGNALK_HOST": "your-boat",
        "SIGNALK_PORT": "3000"
      }
    }
  }
}
```

Then start `gemini` and ask: *"Look at my boat's data and suggest some KIP dashboards."*

To let it **save** dashboards to the boat, add `"SIGNALK_TOKEN": "your-token"` to `env`.
Without a token it can still produce a `KipConfig.json` file for you to import in KIP.
