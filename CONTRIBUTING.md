# Contributing

Thanks for helping improve `kip-mcp-server`. This guide covers how to set up, the workflow we
follow, and how changes get released. For how the code is organised, see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Set up

You need [Node.js](https://nodejs.org) 24 (the current LTS). Then:

```bash
git clone https://github.com/dillan/kip-mcp-server.git
cd kip-mcp-server
npm ci
```

Common commands:

```bash
npm run typecheck   # check types (tsc --noEmit)
npm run lint        # check code style (eslint)
npm run lint:fix    # fix what can be fixed automatically
npm test            # run the tests
npm run test:coverage  # run the tests with coverage
npm run build       # compile to dist/
npm run smoke       # start the built server and check it answers over MCP
npm run ci          # run the whole set: typecheck, lint, build, coverage, smoke
```

Run `npm run ci` before you open a pull request — it's the same set CI runs.

## How we work

**Tests come first.** Write the failing test before the change, and make sure it fails on
behaviour (not just a missing import). Commit the red test and the change that makes it green
as separate commits — the red commit's message should say the test is expected to fail and
why. The dispatchers (`callTool` and friends) and the subsystems are pure and easy to test
directly; the server is exercised end to end through an in-memory MCP client in
`src/kip-mcp-server.spec.ts`.

**Smoke-test the built thing.** Some breakage only shows up in the compiled, packaged server
(for example an import that works under the test runner but not in plain Node). `npm run smoke`
starts `dist/index.js` and drives it exactly like a real client, so run it after a build.

**Keep changes small and focused.** One logical change per commit, with a clear message.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
`docs:`, `chore:`, …). A commit-message hook runs [commitlint](https://commitlint.js.org/),
and a pre-commit hook runs the linter, so both have to pass before a commit lands. The commit
*types* also drive versioning (see [Releases](#releases)).

Write plain, readable messages. Don't add AI attribution lines.

## Pull requests

Branch off `main`, push your branch, and open a pull request. `main` is protected: it only
changes through pull requests, which keeps the history clean and lets CI gate every change.

Dependency updates come in automatically from Dependabot (grouped, weekly). Those PRs are fine
to merge once green.

## Releases

Releases are automatic. On every push to `main`,
[semantic-release](https://semantic-release.gitbook.io/) reads the Conventional Commit
messages, works out the next version, publishes to npm, and creates a GitHub Release with the
notes. Publishing uses **npm Trusted Publishing (OIDC)** — there is no stored npm token. See
[docs/publishing.md](./docs/publishing.md) for the details.

You'll notice `package.json` keeps the placeholder version `0.0.0-development`. That's on
purpose: semantic-release sets the real version at publish time, so the committed file never
needs a version bump.
