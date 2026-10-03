import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const codexManifestPath = "pstack/.codex-plugin/plugin.json";

// Exercise the real scripts against a small upstream snapshot without touching the checkout.
function createFixture(testContext) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "codex-packaging-"));
  testContext.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  for (const path of ["scripts", "schemas", ".agents", "pstack/.cursor-plugin"]) {
    cpSync(join(repositoryRoot, path), join(fixtureRoot, path), { recursive: true });
  }
  symlinkSync(join(repositoryRoot, "node_modules"), join(fixtureRoot, "node_modules"), "dir");
  mkdirSync(join(fixtureRoot, "pstack/skills"), { recursive: true });
  writeJSON(fixtureRoot, ".cursor-plugin/marketplace.json", {
    name: "test-upstream",
    plugins: [{ name: "pstack", source: "pstack" }],
  });
  return fixtureRoot;
}

function writeJSON(fixtureRoot, path, value) {
  mkdirSync(dirname(join(fixtureRoot, path)), { recursive: true });
  writeFileSync(join(fixtureRoot, path), JSON.stringify(value));
}

function runScript(fixtureRoot, script) {
  return spawnSync(process.execPath, [join(fixtureRoot, "scripts", script)], { encoding: "utf8" });
}

test("generation is repeatable and follows upstream metadata", (testContext) => {
  const fixtureRoot = createFixture(testContext);
  assert.equal(runScript(fixtureRoot, "sync-devin-manifests.mjs").status, 0);
  const firstManifest = readFileSync(join(fixtureRoot, codexManifestPath), "utf8");
  assert.equal(runScript(fixtureRoot, "sync-devin-manifests.mjs").status, 0);
  assert.equal(readFileSync(join(fixtureRoot, codexManifestPath), "utf8"), firstManifest);
  const upstreamManifest = JSON.parse(firstManifest);
  upstreamManifest.version = "9.0.0";
  writeJSON(fixtureRoot, "pstack/.cursor-plugin/plugin.json", upstreamManifest);
  assert.equal(runScript(fixtureRoot, "validate-plugins.mjs").status, 1);
  assert.equal(runScript(fixtureRoot, "sync-devin-manifests.mjs").status, 0);
  assert.equal(JSON.parse(readFileSync(join(fixtureRoot, codexManifestPath))).version, "9.0.0");
  assert.equal(runScript(fixtureRoot, "validate-plugins.mjs").status, 0);
});

test("new upstream plugins get Devin packaging without joining the Codex catalog", (testContext) => {
  const fixtureRoot = createFixture(testContext);
  const catalogBefore = readFileSync(join(fixtureRoot, ".agents/plugins/marketplace.json"), "utf8");
  writeJSON(fixtureRoot, ".cursor-plugin/marketplace.json", {
    name: "test-upstream",
    plugins: [{ name: "pstack", source: "pstack" }, { name: "another-plugin", source: "another-plugin" }],
  });
  writeJSON(fixtureRoot, "another-plugin/.cursor-plugin/plugin.json", { name: "another-plugin", version: "1.0.0" });
  assert.equal(runScript(fixtureRoot, "sync-devin-manifests.mjs").status, 0);
  assert.ok(existsSync(join(fixtureRoot, "another-plugin/.devin-plugin/plugin.json")));
  assert.ok(!existsSync(join(fixtureRoot, "another-plugin/.codex-plugin")));
  assert.equal(readFileSync(join(fixtureRoot, ".agents/plugins/marketplace.json"), "utf8"), catalogBefore);
  assert.equal(runScript(fixtureRoot, "validate-plugins.mjs").status, 0);
});

for (const missingPath of ["pstack", "pstack/skills"]) {
  test(`generation fails before writing when ${missingPath} is missing`, (testContext) => {
    const fixtureRoot = createFixture(testContext);
    rmSync(join(fixtureRoot, missingPath), { recursive: true });
    const result = runScript(fixtureRoot, "sync-devin-manifests.mjs");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Cannot package pstack for Codex/);
    assert.ok(!existsSync(join(fixtureRoot, "pstack/.devin-plugin")));
  });
}

test("delisting pstack fails even when its files remain", (testContext) => {
  const fixtureRoot = createFixture(testContext);
  writeJSON(fixtureRoot, ".cursor-plugin/marketplace.json", { name: "test-upstream", plugins: [] });
  assert.equal(runScript(fixtureRoot, "sync-devin-manifests.mjs").status, 1);
});

test("validation rejects extra Codex plugins and invalid skill paths", (testContext) => {
  const fixtureRoot = createFixture(testContext);
  assert.equal(runScript(fixtureRoot, "sync-devin-manifests.mjs").status, 0);
  const manifest = JSON.parse(readFileSync(join(fixtureRoot, codexManifestPath)));
  manifest.skills = "../another-plugin/skills/";
  writeJSON(fixtureRoot, codexManifestPath, manifest);
  assert.equal(runScript(fixtureRoot, "validate-plugins.mjs").status, 1);
  assert.equal(runScript(fixtureRoot, "sync-devin-manifests.mjs").status, 0);
  const catalog = JSON.parse(readFileSync(join(fixtureRoot, ".agents/plugins/marketplace.json")));
  catalog.plugins.push({ ...catalog.plugins[0], name: "another-plugin" });
  writeJSON(fixtureRoot, ".agents/plugins/marketplace.json", catalog);
  assert.equal(runScript(fixtureRoot, "validate-plugins.mjs").status, 1);
});
