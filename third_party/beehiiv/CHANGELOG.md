# Changelog

All notable changes to this plugin will be documented here.

## 1.0.0 — initial release

- Added the `beehiiv` MCP server pointing at beehiiv's hosted Streamable HTTP endpoint (`https://mcp.beehiiv.com/mcp`).
- Auth uses OAuth with beehiiv user login (PKCE, dynamic client registration on `mcp.beehiiv.com`) — no API key or client ID to configure. Registration was verified to accept every Cursor redirect set, including Grok Bot mobile.
- Logo: beehiiv's official hive mark, from the app icon published on beehiiv.com, on a 192×192 tile.
