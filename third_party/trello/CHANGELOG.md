# Changelog

All notable changes to this plugin will be documented here.

## 1.0.0 — initial release

- Added the `trello` MCP server pointing at Atlassian's hosted Streamable HTTP endpoint for Trello (`https://mcp.trello.com/v1`).
- Auth uses OAuth with Atlassian account login (PKCE, dynamic client registration via Atlassian's authorization server at `auth.atlassian.com`) — no API key or client ID to configure. Registration was verified to accept every Cursor redirect set, including Grok Bot mobile.
- Logo: Trello's official mark, taken from the logo Atlassian publishes in the `atlassian/trello-mcp-server` repository, on a 192×192 tile.
