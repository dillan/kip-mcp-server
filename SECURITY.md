# Security Policy

## Reporting a vulnerability

Please report security problems privately, so they can be fixed before they become public.

Use GitHub's **[private vulnerability reporting](https://github.com/dillan/kip-mcp-server/security/advisories/new)**
— the "Report a vulnerability" button on the repository's **Security** tab. That keeps the
report between you and the maintainers until a fix is ready. Please don't open a public issue
for a security problem.

It helps to include:

- what the problem is and where (a file, a tool, an endpoint);
- the steps to reproduce it;
- what someone could do with it.

You can expect an acknowledgement within a few days.

## Credentials this server handles

`kip-mcp-server` talks to a Signal K server on your own network. To **write** dashboards it can
hold a Signal K token, or a username and password. Keep those out of shared logs and configs:

- Put them in a local `.env` file (which is git-ignored) or in your AI client's secret settings.
- Never commit real credentials. Use the scrubbed placeholders in [.env.example](./.env.example).
- Reading data needs no login at all, so only set credentials when you actually need to write.

## Supported versions

Fixes are released from the latest version on npm. Please upgrade to the newest release before
reporting, in case the issue is already fixed.
