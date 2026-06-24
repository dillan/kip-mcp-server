# Claude Desktop

1. Open the MCP config file, `claude_desktop_config.json` — in Claude Desktop,
   **Settings → Developer → Edit Config** opens it (and creates it if it doesn't exist yet).
   It lives at:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
     (that's `C:\Users\<you>\AppData\Roaming\Claude\claude_desktop_config.json`)
   - **Linux:** Anthropic doesn't ship Claude Desktop for Linux; unofficial community builds use
     `~/.config/Claude/claude_desktop_config.json`. (Claude **Code**, the CLI, _does_ run on
     Linux — see [its guide](./claude-code.md).)
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
