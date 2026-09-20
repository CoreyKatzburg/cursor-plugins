#!/usr/bin/env node

// Keeps every plugin's `.devin-plugin/plugin.json` in sync with its
// `.cursor-plugin/plugin.json`. Devin resolves manifests as
// `.devin-plugin/plugin.json` > `.claude-plugin/plugin.json` > root
// `plugin.json` and ignores the Cursor manifest, so each plugin needs its own
// Devin manifest to be installable. MCP-only plugins additionally need
// `.mcp.json` at the plugin root (Devin does not read the manifest's
// `mcpServers` path), which is kept as a symlink to the Cursor `mcp.json`.

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const marketplace = JSON.parse(
  readFileSync(join(root, ".cursor-plugin/marketplace.json"), "utf-8")
);

const changes = [];
const record = (action, path) => changes.push(`${action} ${path}`);

function devinManifest(cursorManifest, entry) {
  return {
    name: cursorManifest.name ?? entry.name,
    displayName: cursorManifest.displayName ?? cursorManifest.name ?? entry.name,
    version: cursorManifest.version,
    description: cursorManifest.description ?? entry.description,
  };
}

function writeIfChanged(path, contents) {
  if (existsSync(path) && readFileSync(path, "utf-8") === contents) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  record("write", relative(root, path));
}

function syncMcpLink(pluginDir) {
  const link = join(pluginDir, ".mcp.json");
  const target = join(pluginDir, "mcp.json");
  const linked = existsSync(link) || lstatSync(link, { throwIfNoEntry: false });

  if (!existsSync(target)) {
    if (linked) {
      rmSync(link);
      record("remove", relative(root, link));
    }
    return;
  }
  if (linked) {
    const stat = lstatSync(link);
    if (stat.isSymbolicLink() && readlinkSync(link) === "mcp.json") return;
    rmSync(link);
  }
  symlinkSync("mcp.json", link);
  record("link", relative(root, link));
}

const managed = new Set();

for (const entry of marketplace.plugins ?? []) {
  const pluginDir = join(root, entry.source);
  const cursorManifestPath = join(pluginDir, ".cursor-plugin/plugin.json");
  if (!existsSync(cursorManifestPath)) {
    console.error(
      `SKIP: ${entry.source} has no .cursor-plugin/plugin.json (listed as "${entry.name}")`
    );
    continue;
  }
  managed.add(resolve(pluginDir));
  const cursorManifest = JSON.parse(readFileSync(cursorManifestPath, "utf-8"));
  writeIfChanged(
    join(pluginDir, ".devin-plugin/plugin.json"),
    JSON.stringify(devinManifest(cursorManifest, entry), null, 2) + "\n"
  );
  syncMcpLink(pluginDir);
}

// Drop manifests for plugins that upstream removed or delisted.
function prune(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (!item.isDirectory() || item.name === ".git" || item.name === "node_modules") continue;
    const child = join(dir, item.name);
    if (item.name === ".devin-plugin") {
      if (managed.has(resolve(dir))) continue;
      rmSync(child, { recursive: true });
      record("remove", relative(root, child));
      const link = join(dir, ".mcp.json");
      if (lstatSync(link, { throwIfNoEntry: false })) {
        rmSync(link);
        record("remove", relative(root, link));
      }
      continue;
    }
    prune(child);
  }
}
prune(root);

if (changes.length === 0) {
  console.log("Devin manifests already in sync");
} else {
  console.log(changes.join("\n"));
}
