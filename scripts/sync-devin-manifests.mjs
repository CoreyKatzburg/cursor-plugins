#!/usr/bin/env node

// Regenerates the Devin manifests from the Cursor ones.
//
// Devin resolves plugin manifests as `.devin-plugin/plugin.json` >
// `.claude-plugin/plugin.json` > root `plugin.json` and ignores
// `.cursor-plugin/plugin.json`, so each plugin needs its own Devin manifest to
// be installable. MCP plugins also need `.mcp.json` at the plugin root, since
// Devin does not read the manifest's `mcpServers` path.
//
// Run it after merging upstream; it rewrites every manifest from scratch and
// deletes the ones whose plugin is gone, so git shows exactly what drifted.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = (path) => JSON.parse(readFileSync(join(root, path), "utf-8"));

const marketplace = readJSON(".cursor-plugin/marketplace.json");
const plugins = marketplace.plugins ?? [];

for (const plugin of plugins) {
  const cursor = readJSON(join(plugin.source, ".cursor-plugin/plugin.json"));

  mkdirSync(join(root, plugin.source, ".devin-plugin"), { recursive: true });
  writeFileSync(
    join(root, plugin.source, ".devin-plugin/plugin.json"),
    JSON.stringify(
      {
        name: cursor.name,
        displayName: cursor.displayName ?? cursor.name,
        version: cursor.version,
        description: cursor.description ?? plugin.description,
      },
      null,
      2
    ) + "\n"
  );

  // `.mcp.json` is a symlink so there is only ever one copy of the config.
  const link = join(root, plugin.source, ".mcp.json");
  rmSync(link, { force: true });
  if (existsSync(join(root, plugin.source, "mcp.json"))) symlinkSync("mcp.json", link);
}

// Plugins live at the repo root or under `third_party/`. Anything with a Devin
// manifest that the marketplace no longer lists was deleted or delisted
// upstream, so its manifest goes too.
const listed = new Set(plugins.map((plugin) => plugin.source));
const candidates = readdirSync(root, { withFileTypes: true })
  .filter((item) => item.isDirectory() && !item.name.startsWith("."))
  .flatMap((item) =>
    item.name === "third_party"
      ? readdirSync(join(root, "third_party")).map((name) => `third_party/${name}`)
      : [item.name]
  );

for (const dir of candidates) {
  if (listed.has(dir) || !existsSync(join(root, dir, ".devin-plugin"))) continue;
  rmSync(join(root, dir, ".devin-plugin"), { recursive: true });
  rmSync(join(root, dir, ".mcp.json"), { force: true });
  console.log(`removed ${dir}/.devin-plugin`);
}

console.log(`synced ${plugins.length} Devin manifests`);
