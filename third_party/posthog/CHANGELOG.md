# Changelog

All notable changes to this plugin will be documented here.

## 1.0.0 — initial release

- Added the `posthog` MCP server pointing at PostHog's hosted Streamable HTTP endpoint (`https://mcp.posthog.com/mcp`).
- Auth uses OAuth with PostHog user login (PKCE, dynamic client registration via `oauth.posthog.com`) — no API key or client ID to configure. Registration was verified to accept every Cursor redirect set, including Grok Bot mobile.
- Logo: PostHog's official hedgehog mark, from the favicon published on posthog.com, in black on a white 192×192 tile.
