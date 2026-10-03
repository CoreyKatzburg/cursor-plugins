#!/usr/bin/env node

import { readFileSync, existsSync, statSync } from "fs";
import { isDeepStrictEqual } from "util";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadJSON(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

const marketplaceSchema = loadJSON(
  resolve(root, "schemas/marketplace.schema.json")
);
const pluginSchema = loadJSON(resolve(root, "schemas/plugin.schema.json"));

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validateMarketplace = ajv.compile(marketplaceSchema);
const validatePlugin = ajv.compile(pluginSchema);

let errors = 0;

function fail(message) {
  console.error(`ERROR: ${message}`);
  errors++;
}

// 1. Validate marketplace.json
const marketplacePath = resolve(root, ".cursor-plugin/marketplace.json");

if (!existsSync(marketplacePath)) {
  fail(".cursor-plugin/marketplace.json not found");
  process.exit(1);
}

const marketplace = loadJSON(marketplacePath);

if (!validateMarketplace(marketplace)) {
  fail("marketplace.json schema validation failed:");
  for (const err of validateMarketplace.errors) {
    console.error(`  ${err.instancePath || "/"}: ${err.message}`);
  }
}

// 2. Validate each plugin
for (const entry of marketplace.plugins ?? []) {
  const pluginDir = resolve(root, entry.source);
  const pluginJsonPath = resolve(pluginDir, ".cursor-plugin/plugin.json");

  // Check source directory exists
  if (!existsSync(pluginDir)) {
    fail(
      `Plugin "${entry.name}": source directory "${entry.source}" does not exist`
    );
    continue;
  }

  // Check plugin.json exists
  if (!existsSync(pluginJsonPath)) {
    fail(
      `Plugin "${entry.name}": missing .cursor-plugin/plugin.json in "${entry.source}"`
    );
    continue;
  }

  const pluginJson = loadJSON(pluginJsonPath);

  if (!validatePlugin(pluginJson)) {
    fail(
      `Plugin "${entry.name}": plugin.json schema validation failed (${entry.source}/.cursor-plugin/plugin.json):`
    );
    for (const err of validatePlugin.errors) {
      const detail =
        err.keyword === "additionalProperties"
          ? `${err.message}: "${err.params.additionalProperty}"`
          : err.message;
      console.error(`  ${err.instancePath || "/"}: ${detail}`);
    }
  }

  // Check that marketplace name matches plugin name
  if (pluginJson.name && pluginJson.name !== entry.name) {
    fail(
      `Plugin "${entry.name}": marketplace name does not match plugin.json name "${pluginJson.name}"`
    );
  }
}

// 3. Codex intentionally exposes only pstack from this marketplace.
const codexMarketplace = loadJSON(resolve(root, ".agents/plugins/marketplace.json"));
const expectedCodexEntry = {
  name: "pstack",
  source: { source: "local", path: "./pstack" },
  policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
  category: "Developer Tools",
};
if (codexMarketplace.name !== "corey-cursor-plugins" ||
    !isDeepStrictEqual(codexMarketplace.plugins, [expectedCodexEntry])) {
  fail("Codex marketplace must list only pstack at ./pstack with the supported install policy.");
}

if (!marketplace.plugins?.some((entry) => entry.name === "pstack" && entry.source === "pstack")) {
  fail("pstack must still be listed in the upstream Cursor marketplace.");
}
const cursorPstackManifest = loadJSON(resolve(root, "pstack/.cursor-plugin/plugin.json"));
const codexPstackManifest = loadJSON(resolve(root, "pstack/.codex-plugin/plugin.json"));
const expectedCodexManifest = {
  name: "pstack",
  version: cursorPstackManifest.version,
  description: cursorPstackManifest.description,
  author: cursorPstackManifest.author,
  skills: "./skills/",
};
if (!isDeepStrictEqual(codexPstackManifest, expectedCodexManifest)) {
  fail("pstack's Codex manifest is stale or invalid; run node scripts/sync-devin-manifests.mjs.");
}
for (const field of ["version", "description"]) {
  if (typeof codexPstackManifest[field] !== "string" || !codexPstackManifest[field].trim()) {
    fail(`pstack's Codex manifest requires a nonempty ${field}.`);
  }
}
if (typeof codexPstackManifest.author?.name !== "string" || !codexPstackManifest.author.name.trim()) {
  fail("pstack's Codex manifest requires an author name.");
}
const pstackSkillsPath = resolve(root, "pstack/skills");
if (!existsSync(pstackSkillsPath) || !statSync(pstackSkillsPath).isDirectory()) {
  fail("pstack's Codex skills path must point to the existing pstack/skills directory.");
}

// 4. Report results
if (errors > 0) {
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log("All plugins validated successfully.");
  process.exit(0);
}
