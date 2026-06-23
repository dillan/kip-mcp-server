# Gemini CLI

Edit `~/.gemini/settings.json` and add a `kip` server. `npx` downloads and runs it on
demand, so there's nothing to install first:

```json
{
  "mcpServers": {
    "kip": {
      "command": "npx",
      "args": ["-y", "kip-mcp-server"],
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
