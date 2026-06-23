# Claude Desktop

1. Open Claude Desktop's settings and edit the MCP config file
   (`claude_desktop_config.json`).
2. Add a `kip` server, using the full path to your built `dist/index.js`:

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

3. Restart Claude Desktop.
4. In a chat, ask: *"Look at my boat's data and suggest some KIP dashboards."*

To let it **save** dashboards to the boat, add `"SIGNALK_TOKEN": "your-token"` to `env`.
Without a token it can still hand you a `KipConfig.json` file to import in KIP.
