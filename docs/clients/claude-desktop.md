# Claude Desktop

1. Open Claude Desktop's settings and edit the MCP config file
   (`claude_desktop_config.json`).
2. Add a `kip` server. `npx` downloads and runs it on demand, so there's nothing to install
   first:

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

3. Restart Claude Desktop.
4. In a chat, ask: *"Look at my boat's data and suggest some KIP dashboards."*

To let it **save** dashboards to the boat, add `"SIGNALK_TOKEN": "your-token"` to `env`.
Without a token it can still hand you a `KipConfig.json` file to import in KIP.
