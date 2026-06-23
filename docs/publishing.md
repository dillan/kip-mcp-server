# Publishing (npm Trusted Publishing)

Releases are automated by [semantic-release](https://semantic-release.gitbook.io/) on
every push to `main`, using **npm Trusted Publishing** (OIDC). No npm token is stored —
not in the repo, not in a secret.

How it works: `.github/workflows/release.yml` grants the job `id-token: write`.
semantic-release exchanges the GitHub Actions OIDC token for a short-lived npm token at
`registry.npmjs.org`, then publishes with **provenance** automatically. (Confirmed in
`@semantic-release/npm`'s `verify-auth.js` / `trusted-publishing/`.)

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
   that already exists, so the very first release needs a one-time bootstrap. Easiest:
   - Let CI run once. If it fails with an OIDC "package not found" error, do a single
     manual publish to create the package, then re-run CI:
     ```bash
     npm login
     npm publish --access public
     ```
   - After the package exists and step 1 is done, every later version is published
     automatically by CI via OIDC — no token, no manual step.

## Requirements (already configured)

- `release.yml` grants `permissions: id-token: write` and `contents: write`.
- The runner upgrades to the latest npm (Trusted Publishing needs **npm >= 11.5.1**) and
  uses Node 24 (the docs ask for **Node >= 22.14**).
- `actions/setup-node` sets `registry-url: https://registry.npmjs.org`.
- No `NPM_TOKEN` / `NODE_AUTH_TOKEN` is set — the OIDC exchange replaces it.

Reference: <https://docs.npmjs.com/trusted-publishers>.
