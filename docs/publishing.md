# Publishing (npm Trusted Publishing)

Releases are automated by [semantic-release](https://semantic-release.gitbook.io/) on
every push to `main`, using **npm Trusted Publishing** (OIDC). No npm token is stored —
not in the repo, not in a secret.

How it works: `.github/workflows/release.yml` grants the job `id-token: write`.
semantic-release exchanges the GitHub Actions OIDC token for a short-lived npm token at
`registry.npmjs.org`, then publishes with **provenance** automatically. (Confirmed in
`@semantic-release/npm`'s `verify-auth.js` / `trusted-publishing/`.)

A release **does not commit anything back to `main`** — it only publishes to npm, creates a
GitHub Release, and pushes the version tag. This is deliberate: `main` is protected and only
changes through pull requests, so an automated commit to it would be rejected
(`GH013: Changes must be made through a pull request`). The `@semantic-release/changelog` and
`@semantic-release/git` plugins are intentionally **not** used. The changelog lives on the
**GitHub Releases** page (with the git tags); the repo's `package.json` keeps its
`0.0.0-development` placeholder while the published npm package gets the real version.

## One-time setup on npmjs.com

Trusted publishing is verified per package, so npm needs the package to exist with a
trusted publisher configured.

1. **Add the trusted publisher.** On npmjs.com open the `kip-mcp-server` package's
   **Settings → Trusted Publisher → GitHub Actions** and set:
   - **Organization or user:** `dillan`
   - **Repository:** `kip-mcp-server`
   - **Workflow filename:** `release.yml` (filename only, not a path)
   - **Allowed actions:** `npm publish`

2. **Bootstrap the first publish.** npm can only verify a trusted publisher for a package
   that already exists. Because `package.json` keeps the placeholder version
   `0.0.0-development` (semantic-release sets real versions), create the package once under
   a side tag, without provenance (provenance only works from CI):
   ```bash
   npm login
   npm publish --access public --tag bootstrap --provenance=false
   ```
   This publishes the placeholder under the `bootstrap` dist-tag, not `latest`. After the
   package exists and step 1 is done, every later version is published automatically by CI
   via OIDC to `latest`, with provenance — no token, no manual step.

   Optional cleanup once a real version is out:
   ```bash
   npm dist-tag rm kip-mcp-server bootstrap
   npm deprecate kip-mcp-server@0.0.0-development "placeholder bootstrap publish"
   ```

## Requirements (already configured)

- `release.yml` grants `permissions: id-token: write` and `contents: write`.
- The runner upgrades to the latest npm (Trusted Publishing needs **npm >= 11.5.1**) and
  uses Node 24 (the docs ask for **Node >= 22.14**).
- `actions/setup-node` sets `registry-url: https://registry.npmjs.org`.
- No `NPM_TOKEN` / `NODE_AUTH_TOKEN` is set — the OIDC exchange replaces it.

Reference: <https://docs.npmjs.com/trusted-publishers>.

## MCP Registry

The package is described for the official [MCP Registry](https://registry.modelcontextprotocol.io)
by [`server.json`](../server.json) (validated against the
`2025-12-11` schema). The registry stores **metadata only** — the package itself lives on
npm — and proves you own the npm artifact through the **`mcpName`** field in `package.json`
(`io.github.dillan/kip-mcp-server`), which must exactly equal the `name` in `server.json`.

Publishing to the registry is a manual step (it needs a GitHub login for the `io.github.dillan`
namespace, which CI can't do interactively):

1. Make sure the npm package is published **with** the `mcpName` field (any release after this
   change has it), then sync the manifest version to the latest published one:
   ```bash
   npm run registry:sync   # writes the latest published npm version into server.json
   ```
   The registry requires `server.json`'s version to match a published npm version that carries
   `mcpName`, so always run this before publishing (package.json keeps its `0.0.0-development`
   placeholder, so the version of record is on npm).
2. Install the CLI: `brew install mcp-publisher`, or download `mcp-publisher` from the
   [registry releases](https://github.com/modelcontextprotocol/registry/releases/latest).
3. Authenticate as the `dillan` GitHub account: `mcp-publisher login github` (device flow).
4. `mcp-publisher publish` — it validates `server.json` against the live schema and submits it.
5. Confirm: `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.dillan/kip-mcp-server"`.

In CI this can be automated with `mcp-publisher login github-oidc` (the repo lives under the
`dillan` namespace, so its OIDC token authorizes `io.github.dillan/*` with no stored secret).
The registry is still in **preview**, so the schema date and API path may change — re-check
the `$schema` value and `/v0.x/` path before publishing.

## awesome-mcp-servers

To list the server on [`awesome-mcp-servers`](https://github.com/punkpeye/awesome-mcp-servers),
fork it, add this line to the closest category (no marine section exists; **Location Services**
fits navigation/GPS), keeping the list alphabetical, then open a PR per its `CONTRIBUTING`:

```markdown
- [dillan/kip-mcp-server](https://github.com/dillan/kip-mcp-server) 📇 🏠 - Design and install
  KIP marine dashboards from a boat's Signal K data (speed, wind, depth, AIS, battery, engine).
```

The legend on that list: 📇 TypeScript/JavaScript codebase, 🏠 Local Service. Check the live
README at submission time — its categories and legend change.
