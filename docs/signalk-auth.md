# Signal K authentication (getting a token)

`kip-mcp-server` only needs credentials to **write** dashboards to your boat. **Reading**
your data — listing paths, analysing, composing previews — needs nothing. So if you only
want previews and a `KipConfig.json` file to import yourself, you can skip this entirely.

To let the assistant **save** dashboards to the server, give the MCP one of two things:

| Setting | What it is |
| --- | --- |
| `SIGNALK_TOKEN` | A Signal K access token. The server sends it as `Authorization: JWT <token>`. |
| `SIGNALK_USER` + `SIGNALK_PASSWORD` | A Signal K login. The server logs in for you and **refreshes automatically** when the session expires. |

The server itself does **not** generate tokens — it consumes one of the above. So the page you
may have found, [Generating Tokens](https://demo.signalk.org/documentation/Security/Generating_Tokens.html),
is **one** way to produce a `SIGNALK_TOKEN`, not the only way, and usually not the simplest for
this server. Here are all the options, easiest first.

## Option A — username & password (simplest, recommended for most)

No token to generate or rotate. Create a user, hand the MCP its credentials, and it logs in
(and re-logs in when the JWT expires).

1. In the Signal K admin UI: **Security → Users → Add**, create a user (e.g. `kip`) and give it
   **write** permission. (A dedicated user is better than reusing your admin login — see
   [Least privilege](#least-privilege).)
2. Set the environment for the MCP:
   ```bash
   SIGNALK_USER=kip
   SIGNALK_PASSWORD=…
   ```

That's it — there is no token step.

## Option B — a long-lived token

Use a token when you'd rather not keep a password in the environment, or you want a credential
with a fixed lifetime. Any of these produce a value for `SIGNALK_TOKEN`:

### B1 — request one over the network (scriptable)

This server ships a helper for the Signal K **device access request** flow:

```bash
npm run signalk:request-token        # uses SIGNALK_HOST / SIGNALK_PORT / SIGNALK_TLS
```

It posts a request to `POST /signalk/v1/access/requests`, then waits while you approve it once in
the admin UI under **Security → Access Requests** (grant **write**). On approval the server issues
a durable token, which the script prints:

```
SIGNALK_TOKEN=eyJhbGciOiJI…
```

The approval is a deliberate human step — it's the server's security boundary, so it can't (and
shouldn't) be fully automated away. Requires **Security → "Allow New Device Registration"** to be on.

### B2 — generate one on the server (CLI)

If you have a terminal on the Signal K server, the bundled
[`signalk-generate-token`](https://demo.signalk.org/documentation/Security/Generating_Tokens.html)
utility mints a token against a user account:

```bash
signalk-generate-token -u kip -e 1y -s ~/.signalk/security.json
#   -u  user account the token is tied to (gets that user's permissions)
#   -e  time to live: 1y / 2h / 10m / 5s
#   -s  path to security.json
```

### B3 — the admin UI (no network/CLI)

**Security → Devices** lets an admin pre-provision a device token directly.

## Which should I use?

- **Just trying it out, or running on the same machine?** Option A (username/password) — least setup.
- **Headless / unattended deployment, or you dislike passwords in env files?** Option B with a
  **dedicated, write-only user** and a token (B1 or B2).
- The HTTP transport (`kip-mcp-http`) uses the same `SIGNALK_*` settings for its single Signal K
  identity; pick one option there too.

## Least privilege

The token or user takes on the **permissions of the account it's tied to**, so don't reuse your
admin login. Create a dedicated user with **write** access (read + write to the paths the
assistant touches is plenty — it never needs admin). If you use a token, set a sensible expiry and
re-issue when it lapses; the username/password option re-authenticates on its own.

## Keep it secret

A token or password lets software change your boat's config. Keep it out of git and shared chats —
put it in the MCP client's env or a local `.env` (see [development.md](./development.md)). If one
leaks, revoke it: delete the user or device under **Security**, or let a short-lived token expire.

## Verifying

Run the built-in doctor to confirm the credential works end to end:

```bash
node dist/index.js --doctor    # checks reachability, version, KIP, and that login/token works
```
