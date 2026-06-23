# kip-mcp-server

An MCP (Model Context Protocol) server that lets an AI assistant look at your boat's
[Signal K](https://signalk.org) data and help you design and install
[KIP](https://github.com/mxtommy/Kip) dashboards.

> **Status: early development.** The project is being built in phases. This first
> milestone sets up the project, tests, and automated checks. Features land next.

## What it will do

- **Look at your boat's data** — find the Signal K values your boat reports (speed,
  wind, depth, batteries, engine, and so on).
- **Suggest dashboards** — propose a general dashboard plus ones for specific jobs
  (sailing, motoring, power, anchoring, navigation, weather), built from KIP's real
  widgets.
- **Show you a preview first** — you see a picture of each dashboard before anything
  is saved.
- **Install them for you** — with your OK, it writes the dashboards to your KIP setup
  (or hands you a file you can import yourself).

## Develop

This project uses Node.js 24 (LTS). Common commands:

```bash
npm install        # install dependencies
npm run typecheck  # check types
npm run lint       # check code style
npm test           # run the tests
npm run build      # compile to dist/
npm run ci         # run the full set of checks
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/); releases
and version numbers are produced automatically from those commit messages.

## License

MIT — see [LICENSE](./LICENSE).
