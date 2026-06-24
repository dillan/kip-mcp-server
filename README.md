# kip-mcp-server

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant (such as
Claude, Codex, or Gemini) look at your boat's [Signal K](https://signalk.org) data and
help you design and install [KIP](https://github.com/mxtommy/Kip) dashboards — the
gauges and panels you see on your chartplotter or tablet.

You stay in control: the assistant shows you a picture of each dashboard first, and it
only saves anything to your boat after you say yes.

## What it does

- **Looks at your boat's data.** It finds the values your boat reports through Signal K
  — speed, wind, depth, batteries, engine, and so on.
- **Suggests dashboards.** It proposes a general dashboard plus ones for specific jobs:
  sailing, motoring, power, anchoring, navigation, and weather.
- **Shows you a preview.** You see a simple picture of each dashboard before anything is
  saved.
- **Installs them — with your OK.** It writes the dashboards to your KIP setup, or hands
  you a file you can import yourself.

## Quick start (for boat owners)

You need a [Signal K](https://signalk.org) server running on your boat (or on your
network), with KIP installed.

1. **Find your Signal K address.** It usually looks like `http://your-boat:3000`. Note
   the host name (or IP) and port.
2. **Get this server.** You don't need to install anything by hand — your AI assistant can
   run it on demand with [`npx`](https://docs.npmjs.com/cli/commands/npx) (which comes with
   [Node.js](https://nodejs.org) 24 or newer):
   ```bash
   npx -y kip-mcp-server
   ```
   The next step wires this command into your assistant. (Prefer to build from source? See
   [Develop](#develop) below.)
3. **Connect it to your AI assistant.** Pick your assistant in [docs/clients](./docs/clients/)
   and follow the short setup there. You tell the assistant your boat's host and port.
4. **Ask it to help.** Say something like *"Look at my boat's data and suggest some KIP
   dashboards."* Review the previews it shows you.
5. **Say yes.** When you're happy, tell it to go ahead. It asks before writing anything.
   If your Signal K server is older, it gives you a `KipConfig.json` file to import from
   KIP's Settings instead.

## How to connect it

The server reads a few settings from its environment:

| Setting | What it is | Default |
| --- | --- | --- |
| `SIGNALK_HOST` | Your Signal K host name or IP | `localhost` |
| `SIGNALK_PORT` | Your Signal K port | `3000` |
| `SIGNALK_TLS` | Set to `true` if your server uses `https` | `false` |
| `SIGNALK_TOKEN` | A Signal K login token, needed to **write** dashboards | (none) |
| `SIGNALK_USER` | A Signal K username — used with `SIGNALK_PASSWORD` instead of a token | (none) |
| `SIGNALK_PASSWORD` | The matching Signal K password | (none) |
| `KIP_URL` | Override where KIP is served, if it's not the default | (derived) |

Reading your data needs no login. Writing dashboards to the server needs either a token or
a username and password; you can always use the file-export option instead, which needs
nothing extra.

## Remote access over HTTP (optional, advanced)

By default the server talks over **stdio** — the assistant runs it as a local subprocess.
There is also an optional **HTTP** mode (`kip-mcp-http`) for hosting the server so a remote
assistant (such as Claude.ai) can reach it over the network. It is opt-in and meant for a
single operator behind a reverse proxy that adds TLS.

```bash
# Behind a TLS-terminating reverse proxy that forwards to 127.0.0.1:3017
MCP_BEARER_TOKEN=a-long-random-secret \
MCP_PUBLIC_URL=https://boat.example.com/mcp \
  npx kip-mcp-http
```

| Setting | What it is | Default |
| --- | --- | --- |
| `HTTP_HOST` | Address to bind | `127.0.0.1` (loopback) |
| `HTTP_PORT` | Port to listen on | `3017` |
| `HTTP_PATH` | URL path for the MCP endpoint | `/mcp` |
| `MCP_BEARER_TOKEN` | One or more (comma-separated) bearer tokens that callers must present | (none) |
| `MCP_PUBLIC_URL` | The public URL clients reach, used for the Host allowlist and metadata | (derived) |
| `MCP_ALLOWED_ORIGINS` | Comma-separated browser origins to accept (off by default) | (none) |
| `MCP_ALLOWED_HOSTS` | Override the Host allowlist | (derived) |
| `MCP_ALLOW_INSECURE` | Set to `true` to start anyway in an unsafe setup | (unset) |

Every request must present a valid `Authorization: Bearer <token>` and pass a Host/Origin
allowlist before it reaches the MCP layer. **The server refuses to start** if it would bind
to a non-loopback address or run without a bearer token, unless you set
`MCP_ALLOW_INSECURE=true`. It uses one Signal K login for all sessions, so treat it as a
single-tenant deployment; the same `SIGNALK_*` settings above apply.

## What the assistant can do

The server gives the assistant a set of tools, grouped by job:

- **Look at the boat** — list the data paths, their units, and which plugins are installed.
- **Know KIP's parts** — list every KIP widget and how it's configured, plus the colours,
  icons and units KIP understands.
- **Design dashboards** — suggest a set of dashboards, build one for a chosen job, and draw
  a preview.
- **Check and save** — check a dashboard is well-formed, export it to a file, or write it to
  the boat (asking first).

## More help

- **[Recipes](./docs/recipes.md)** — worked examples of asking the assistant to design dashboards.
- **[Troubleshooting](./docs/troubleshooting.md)** — fixes for the common problems, starting with
  the built-in `--doctor` check.
- **[Tool reference](./docs/tools.md)** — every tool and prompt the assistant can use.

## Glossary

A few terms, in plain words:

- **Signal K** — the open system many boats use to share data (speed, wind, depth, …) over
  the network.
- **path** — the name of one piece of data, like `navigation.speedOverGround` (speed over
  ground).
- **KIP** — the app that shows your boat's data as dashboards of gauges and panels.
- **widget** — one gauge or panel on a dashboard (a number, a dial, a wind display, …).
- **dashboard** — a screen full of widgets, laid out on a grid.
- **token** — like a password for software: it lets the server save changes to your boat.
- **dry run** — the assistant tells you what it *would* do, without actually doing it. Saving
  is a dry run by default.

## Develop

This project uses Node.js 24 (LTS). Common commands:

```bash
npm install        # install dependencies
npm run typecheck  # check types
npm run lint       # check code style
npm test           # run the tests
npm run build      # compile to dist/
npm run smoke      # start the built server and check it answers
npm run ci         # run the full set of checks
```

For a full guide to running and testing the server locally during development — pointing an AI
client or the MCP Inspector at a local build, running the HTTP transport, and testing against
Signal K (or offline) — see [docs/development.md](./docs/development.md).

Commits follow [Conventional Commits](https://www.conventionalcommits.org/); releases and
version numbers are produced automatically from those commit messages.

## License

MIT — see [LICENSE](./LICENSE).
