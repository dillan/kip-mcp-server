# Architecture

This server has one job: give an AI assistant a safe, well-described set of tools for
reading a boat's [Signal K](https://signalk.org) data and designing
[KIP](https://github.com/mxtommy/Kip) dashboards from it. This page explains how the code
is laid out and how a request flows through it.

## The big picture

```
AI assistant ──MCP(stdio)──▶ KipMCPServer ──▶ tool dispatchers ──▶ subsystems ──▶ Signal K
                             (src/kip-mcp-server.ts)               (schema, discovery,
                                                                    compose, write)
```

The server itself is thin wiring. All the real work lives in small, separately tested
modules, so the logic can be unit-tested without starting a server or touching the network.

## Module map

**Entry and wiring**

- `src/index.ts` — the command-line entry point (the `kip-mcp-server` bin). Loads `.env`,
  builds a `KipMCPServer`, and runs it over stdio.
- `src/kip-mcp-server.ts` — registers every tool and resource with the MCP SDK and routes
  each call to the right dispatcher. Holds the Signal K clients and the loaded schema.
- `src/tool-spec.ts` — the shared shape of a tool: its zod input and output schemas (the
  single source of truth, which the SDK turns into JSON Schema) and its behaviour hints
  (read-only, open-world, write). Also wraps each result as text **plus** machine-readable
  structured content.
- `src/config.ts` — reads settings from the environment (host, port, TLS, token, KIP URL).
- `src/resources.ts` — reads the bundled guide text exposed as an MCP resource.

**Tool layers** (each module pairs the tool definitions with a tested dispatcher)

- `src/tools.ts` — the design *vocabulary*: list widgets, get a widget's schema, the design
  system, unit options, validate a dashboard, export a config. Pure reads over the schema.
- `src/discovery-tools.ts` — read the live boat: analyse data, list paths, path metadata,
  server info, installed plugins.
- `src/compose-tools.ts` — design dashboards: compose one for an intent, recommend a set,
  preview one.
- `src/write-tools.ts` — read and write the stored KIP config (dry run by default).

**Subsystems** (the logic the dispatchers call)

- `src/schema/` — loads the KIP dashboard schema. `kip-schema.ts` fetches the live schema
  from KIP and falls back to a bundled snapshot; `schema-types.ts` describes its shape.
- `src/discovery/` — talks to Signal K. `sk-client.ts` is a small read-only HTTP client;
  `discover.ts` orchestrates a full scan; `inventory.ts` flattens the vessel data tree into
  a list of paths (with units) and a set of capabilities.
- `src/compose/` — designs dashboards. `templates.ts` holds the use-case intents;
  `resolver.ts` binds widgets to the boat's paths; `layout.ts` packs them onto the 24-column
  grid; `node-builder.ts` builds each widget node; `dashboard-builder.ts` assembles the
  dashboard and draws the ASCII preview; `units-match.ts` matches Signal K units to KIP's.
- `src/write/` — reads and writes the KIP config in Signal K's `applicationData` store.
  `appdata-client.ts` is the REST client; `config-builder.ts` builds a complete config;
  `apply-plan.ts` decides whether to seed a full config or patch the dashboards; `defaults.ts`
  holds the default `app` block.
- `src/vocabulary.ts` — pure read helpers over the schema (the logic behind the vocabulary
  tools).
- `src/validators.ts` — structural validation of a dashboard (the invariants KIP relies on).
- `src/utils/paths.ts` — small path helpers.

## How a "design my dashboards" request flows

1. **Load the schema** (`schema/`). The server fetches KIP's dashboard schema, or uses the
   bundled snapshot if KIP can't be reached.
2. **Discover the boat** (`discovery/`). It reads the Signal K server info and the vessel data
   tree, then flattens it into paths (with units), capabilities, and the installed plugins.
3. **Compose** (`compose/`). For each intent, it picks a template, binds widgets to the paths
   the boat actually has, lays them out on the grid, builds a byte-compatible dashboard, and
   renders an ASCII preview. Widgets the boat can't support are reported as "dropped".
4. **Validate** (`validators.ts`). Each dashboard is checked against the structural rules.
5. **Apply** (`write/`). Writing is a dry run by default: it shows what it *would* do. With
   confirmation it writes to `applicationData`, or — on older Signal K servers — hands back a
   `KipConfig.json` file to import from KIP's Settings.

## The schema, and keeping it in sync

The tools lean on a generated description of KIP — every widget, its default config, the
colour tokens, icons and unit groups. That artifact is produced by KIP's own
`gen:mcp-schema` tool and lives in the KIP repository. A snapshot is bundled here at
`src/resources/bundled-schema.json` as a fallback.

At runtime the server prefers the **live** schema served by your installed KIP, so it always
matches the KIP you're running; the bundled snapshot is only used when KIP can't be reached.
Because the snapshot can drift from KIP over time, treat the live fetch as the source of
truth and refresh the bundled copy when KIP changes.
