# Troubleshooting

## Start here: run the doctor

Most connection problems are diagnosed in one step. From a terminal:

```bash
npx -y kip-mcp-server --doctor
```

Set your boat's address first if it isn't the default, e.g.:

```bash
SIGNALK_HOST=your-boat SIGNALK_PORT=3000 npx -y kip-mcp-server --doctor
```

It checks, in order, that:

1. the Signal K server is reachable,
2. its version supports saving dashboards (needs 1.27 or newer),
3. KIP is serving its live schema, and
4. your login works (when you've set one).

Each line is marked **OK**, **WARN**, **FAIL** or **SKIP**, with guidance for anything that isn't OK.

## Common problems

**The assistant doesn't see any KIP tools.**
Check the server is wired into your assistant correctly — see the guide for your assistant in
[docs/clients](./clients/). After changing the config, restart the assistant.

**"Could not reach Signal K …"**
The server can't reach your Signal K server. Check `SIGNALK_HOST`, `SIGNALK_PORT`, and
`SIGNALK_TLS` (set it to `true` only if your server uses `https`), and that the server is running.
Run `--doctor` to confirm.

**Saving fails with an authentication error (HTTP 401 or 403).**
Reading data needs no login, but **writing** dashboards does. Set a token (`SIGNALK_TOKEN`) or a
username and password (`SIGNALK_USER` and `SIGNALK_PASSWORD`). See
[Signal K authentication](./signalk-auth.md) for how to get a token (`npm run signalk:request-token`)
and [.env.example](../.env.example).

**"Using the bundled schema generated for KIP …" warning.**
The server couldn't fetch the live schema from your KIP, so it fell back to a bundled copy. Things
still work, but the widget list may not match your exact KIP version. Check KIP is installed and
served at `http://<your-boat>:<port>/@mxtommy/kip/`, or set `KIP_URL` to where KIP actually lives.

**Saving is refused on an older Signal K server.**
Servers older than 1.27 have no place to store the config. Ask the assistant to use the file export
instead (`export_kip_config`): it gives you a `KipConfig.json` you import from KIP's **Settings**.

**"SIGNALK_PORT must be a number…" or "KIP_URL must be a valid URL…" at startup.**
A setting is malformed. Fix the value — the message says which one and what it expects.

## Still stuck?

Open an issue with the output of `--doctor` (it contains no secrets) and the
[setup guide](./clients/) you followed.
