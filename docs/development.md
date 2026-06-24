# Running kip-mcp-server locally (development & testing)

This guide is for working **on** the server — running it from source, pointing an AI client or the
MCP Inspector at your local build, and testing it against Signal K (or with no Signal K at all).

If you just want to **use** the server on your boat, follow the [README](../README.md) and the
[client guides](./clients/) instead — those run the published package with `npx`, which is the right
thing for real use. This page is the opposite: everything points at a local checkout.

## Setup

You need [Node.js](https://nodejs.org) 24 (the current LTS): `node --version`.

```bash
git clone https://github.com/dillan/kip-mcp-server.git
cd kip-mcp-server
npm ci
npm run build      # compiles src/ -> dist/ (flat: dist/index.js, dist/http-server.js)
```

## The inner loop

```bash
npm run dev          # compile and watch — rebuilds dist/ on every save
npm test             # run the tests
npm run test:coverage  # tests with coverage (thresholds enforced)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write
npm run ci           # the full gate CI runs (see below)
```

Run `npm run ci` before opening a pull request — it runs format-check, typecheck, lint, build, the
tool-reference drift check, coverage, and both smoke tests, exactly as CI does.

## End-to-end test against a real Signal K (Docker)

`npm run ci` is all in-process. To prove the **built binary** works against a **real** Signal K
server, there's a separate end-to-end test (needs Docker, and a build first):

```bash
npm run build
npm run test:e2e
```

It spins up a throwaway Signal K server in Docker (`docker-compose.e2e.yml`, preloaded with a
known admin user from `tests/e2e/`), seeds it with vessel data, then drives `dist/index.js` over
MCP exactly as a client would: log in, `analyze_signalk_data`, `compose_dashboard`,
`apply_kip_config` (a real `applicationData` write), and `read_kip_config` to confirm it
persisted. The container is torn down at the end. CI runs this as a separate `e2e` job, kept
apart from the main gate so a slow image pull doesn't block it.

## Quickest look: the MCP Inspector

The fastest way to see what the server exposes, with no AI client:

```bash
npm run inspect        # builds, then opens the MCP Inspector wired to your local stdio server
npm run inspect:http   # the same, but against the HTTP transport
```

The Inspector is a small web UI. You can list and call every tool, render the prompts, read the
resources, and see the raw JSON — handy while iterating on a tool.

## Run the stdio server from source

```bash
node dist/index.js
```

This runs the server over **stdio** — the same transport Claude Desktop and Claude Code use. It
waits for an MCP client on stdin/stdout, so you won't see a prompt; that's normal. Ctrl-C to stop.
Settings come from the environment, or a local `.env` (see [below](#signal-k-data-during-development)).

`npm run smoke` builds and then drives the stdio server exactly like a real client — a good sanity
check that the packaged binary works.

## Point an AI client at your local build

Use the same setup as the [client guides](./clients/), but swap `npx` for your local `dist/index.js`.
Keep a distinct server name (e.g. `kip-dev`) so it doesn't clash with a published install.

**Claude Code:**

```bash
claude mcp add kip-dev \
  -e SIGNALK_HOST=localhost -e SIGNALK_PORT=3000 \
  -- node /full/path/to/kip-mcp-server/dist/index.js
```

**Claude Desktop / Codex / Gemini:** in the JSON/TOML from the [client guide](./clients/), replace

```json
"command": "npx", "args": ["-y", "kip-mcp-server"]
```

with

```json
"command": "node", "args": ["/full/path/to/kip-mcp-server/dist/index.js"]
```

Rebuild (`npm run build`, or leave `npm run dev` running) and restart the client after changes.

## Run the HTTP transport locally

The HTTP transport (`kip-mcp-http` → `dist/http-server.js`) is for remote/hosted clients. To run it
on your machine:

```bash
MCP_BEARER_TOKEN=dev-secret node dist/http-server.js   # loopback + a token (recommended)
MCP_ALLOW_INSECURE=true node dist/http-server.js        # loopback, no token (dev only)
```

It binds `127.0.0.1:3017` with the MCP endpoint at `/mcp` by default. It **refuses to start** when
bound to a non-loopback address, or with no bearer token, **unless** you set `MCP_ALLOW_INSECURE=true`.
That guard is deliberate — only relax it for local testing, never for a real deployment.

| Setting | What it is | Default |
| --- | --- | --- |
| `HTTP_HOST` | bind address (keep it loopback locally) | `127.0.0.1` |
| `HTTP_PORT` | port | `3017` |
| `HTTP_PATH` | the MCP endpoint path | `/mcp` |
| `MCP_BEARER_TOKEN` | accepted bearer token(s), comma-separated | (none) |
| `MCP_ALLOW_INSECURE` | allow an unauthenticated and/or non-loopback bind | `false` |
| `MCP_ALLOWED_ORIGINS` | browser `Origin` allowlist (CSRF) | (off) |
| `MCP_ALLOWED_HOSTS` | `Host` header allowlist (DNS-rebinding) | (derived) |
| `MCP_PUBLIC_URL` | external URL when behind a reverse proxy | (derived) |

Poke at it:

```bash
curl -s http://127.0.0.1:3017/healthz                  # health check, no auth
npm run inspect:http                                   # the Inspector against HTTP
```

`npm run smoke:http` starts the built HTTP server and drives it end to end, including the
refuse-to-start and 401-without-token behaviour.

## Signal K data during development

The server reads its Signal K connection from the environment. The easiest setup is to copy
`.env.example` to `.env` and fill it in — both the stdio and HTTP entrypoints load `.env`
automatically.

| Setting | What it is | Default |
| --- | --- | --- |
| `SIGNALK_HOST` / `SIGNALK_PORT` | your Signal K server | `localhost` / `3000` |
| `SIGNALK_TLS` | `true` if it uses `https` | `false` |
| `SIGNALK_TOKEN` | a token (needed to **write** dashboards) | (none) |
| `SIGNALK_USER` + `SIGNALK_PASSWORD` | username/password login, instead of a token | (none) |
| `KIP_URL` | where KIP is served, if not the default | (derived) |

### With a local Signal K server

Point `SIGNALK_HOST`/`SIGNALK_PORT` at it. The discovery, compose and write tools (and
`check_connection`) need a live server. Run the doctor to confirm everything is wired up:

```bash
node dist/index.js --doctor
```

It checks the server is reachable, the version supports writing dashboards (≥ 1.27), KIP is serving
its schema, and your login works — printing pass/warn/fail with guidance for anything that isn't OK.

### Without a Signal K server

The server still starts, and the **design-vocabulary** tools work entirely offline against the
bundled KIP schema: `get_kip_initial_context`, `list_kip_widgets`, `get_widget_schema`,
`get_design_system`, `get_unit_options`, `validate_kip_config`, `export_kip_config`, and the prompts.
You'll see a one-line "Using the bundled schema…" warning — that's expected offline.

The tools that read or write the boat (`analyze_signalk_data`, `compose_dashboard`,
`apply_kip_config`, `check_connection`, …) need a live server and will report a clear connection
error without one.

## Keeping generated files in sync

```bash
npm run docs:tools     # regenerate docs/tools.md from the live tool surface
npm run schema:refresh # refresh the bundled KIP schema from a running KIP (SIGNALK_HOST/PORT or KIP_URL)
```

Run `docs:tools` after you add or change a tool or prompt — CI's `docs:check` fails if `docs/tools.md`
is stale. See [ARCHITECTURE](../ARCHITECTURE.md) for how the bundled schema stays in sync with KIP.

## A full local round-trip

With a local Signal K + KIP running and a write token set in `.env`:

1. `npm run build` (or leave `npm run dev` running).
2. Point your AI client at `node …/dist/index.js`, or just run `npm run inspect`.
3. Pick the `design_dashboards` prompt, or ask: *"Look at my boat's data and suggest some KIP dashboards."*
4. It runs `analyze_signalk_data` → `recommend_dashboard_set` and shows you previews.
5. Say go ahead → `apply_kip_config` writes to KIP (it confirms with you first).
6. Open KIP in a browser to see the dashboard on the boat.

For the test-first workflow, commit conventions, and how pull requests and releases work, see
[CONTRIBUTING](../CONTRIBUTING.md).
