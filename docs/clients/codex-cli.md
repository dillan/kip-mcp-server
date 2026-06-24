# Codex CLI

Edit Codex's `config.toml` and add a `kip` server. `npx` downloads and runs it on demand,
so there's nothing to install first. The file lives at:

- **macOS / Linux:** `~/.codex/config.toml`
- **Windows:** `%USERPROFILE%\.codex\config.toml` (that's `C:\Users\<you>\.codex\config.toml`)

(If you've set `CODEX_HOME`, it's `$CODEX_HOME/config.toml` instead.)

```toml
[mcp_servers.kip]
command = "npx"
args = ["-y", "kip-mcp-server"]
env = { SIGNALK_HOST = "your-boat", SIGNALK_PORT = "3000" }
```

Then start `codex` and ask: *"Look at my boat's data and suggest some KIP dashboards."*

To let it **save** dashboards to the boat, add `SIGNALK_TOKEN = "your-token"` to `env`.
Without a token it can still produce a `KipConfig.json` file for you to import in KIP.
