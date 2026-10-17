#!/usr/bin/env node

import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { createVerifiedTarballs } from "./package-tarballs.mjs";

const repoRoot = process.cwd();
const skillRoot = resolve(repoRoot, "skills/viselora-dom-webgl");
const templateRoot = resolve(skillRoot, "templates/react-vite");

const temporaryRoot = await mkdtemp(
  resolve(tmpdir(), "viselora-skill-template-"),
);
const packed = createVerifiedTarballs(repoRoot);

try {
  await cp(templateRoot, temporaryRoot, { recursive: true });
  // Recipes are copied into consumers, so they must typecheck in the template.
  await cp(resolve(skillRoot, "recipes"), resolve(temporaryRoot, "src/recipes"), {
    recursive: true,
  });
  run("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    packed.packages[0].tarballPath,
    packed.packages[1].tarballPath,
  ]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "build"]);
  process.stdout.write("Viselora skill template and recipes typecheck/build passed\n");
} finally {
  packed.cleanup();
  await rm(temporaryRoot, { force: true, recursive: true });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: temporaryRoot,
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}
