#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { createExternalConsumerFixture } from "./external-consumer-fixture.mjs";
import { createVerifiedTarballs } from "./package-tarballs.mjs";

const repoRoot = process.cwd();
const fixtureRoot = mkdtempSync(join(tmpdir(), "viselora-external-consumer-"));
let packed;

try {
  packed = createVerifiedTarballs(repoRoot);
  const [core, adapters] = packed.packages;
  createExternalConsumerFixture(
    fixtureRoot,
    core.tarballPath,
    adapters.tarballPath,
  );
  process.stdout.write(`External fixture: ${fixtureRoot}\n`);
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
  run(process.execPath, ["scripts/verify-ssr.mjs"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["test"]);
  run("npm", ["run", "build"]);
  run("npm", ["run", "test:browser"]);
  process.stdout.write(
    `External browser evidence: ${readFileSync(join(fixtureRoot, "evidence/browser-capabilities.json"), "utf8")}`,
  );
  process.stdout.write("External consumer verification passed\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  packed?.cleanup();
  rmSync(fixtureRoot, { force: true, recursive: true });
  process.stdout.write("External fixture cleanup complete\n");
}

function run(command, args) {
  const executable =
    process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(executable, args, {
    cwd: fixtureRoot,
    encoding: "utf8",
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${String(result.status)}`);
  }
}
