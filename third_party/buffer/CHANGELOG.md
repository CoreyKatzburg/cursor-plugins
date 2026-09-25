# Changelog

All notable changes to this plugin will be documented here.

## 1.0.0 — initial release

- Added the `buffer` MCP server pointing at Buffer's hosted Streamable HTTP endpoint (`https://mcp.buffer.com/mcp`).
- Auth uses OAuth with Buffer user login (PKCE, dynamic client registration via `auth.buffer.com`) — no API key or client ID to configure. Registration was verified to accept every Cursor redirect set, including Grok Bot mobile.
- Logo: Buffer's official stacked mark, from the icon published on buffer.com, on a 192×192 tile.
