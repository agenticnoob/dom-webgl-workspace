#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  collectPublicApi,
  renderApiSurface,
} from "./generate-api-surface.mjs";

const skillRoot = "skills/viselora-dom-webgl";

export function checkApiCoverage(root) {
  const violations = [];
  const api = collectPublicApi(root);
  const coverage = readJson(root, `${skillRoot}/references/api-coverage.json`);
  const generatedPath = `${skillRoot}/references/api-surface.generated.md`;
  const generated = readText(root, generatedPath);
  const expectedGenerated = renderApiSurface(api);
  const skill = readText(root, `${skillRoot}/SKILL.md`);
  const statusText = readText(root, `${skillRoot}/references/capability-status.md`);
  const runtimePackage = readJson(root, "packages/dom-webgl-runtime/package.json");
  const adaptersPackage = readJson(root, "packages/dom-webgl-scroll-adapters/package.json");
  const expectedVersion = api.version;

  if (generated !== expectedGenerated) {
    violations.push(
      "api-surface.generated.md is stale; run npm run skill:api:generate",
    );
  }

  const versionSources = [
    ["runtime package", runtimePackage.version],
    ["adapter package", adaptersPackage.version],
    ["adapter dependency", adaptersPackage.dependencies?.["@viselora/dom-webgl"]],
    ["skill", readCompatibleVersion(skill)],
    ["coverage", coverage.compatiblePackageVersion],
    ["generated index", readCompatibleVersion(generated)],
    ["capability status", readCompatibleVersion(statusText)],
  ];
  for (const [source, version] of versionSources) {
    if (version !== expectedVersion) {
      violations.push(
        `Version mismatch: ${source} expected ${expectedVersion}, received ${version ?? "missing"}`,
      );
    }
  }

  const statuses = parseStatuses(statusText, violations);
  let valueCount = 0;
  let typeCount = 0;
  for (const entrypoint of api.entrypoints) {
    const mappings = coverage.entrypoints?.[entrypoint.entrypoint] ?? {};
    const actualValues = new Set(
      entrypoint.exports
        .filter((record) => record.kind === "value")
        .map((record) => record.name),
    );
    for (const record of entrypoint.exports) {
      if (record.kind === "value") {
        valueCount += 1;
        if (!mappings[record.name]) {
          violations.push(
            `missing public value mapping: ${entrypoint.entrypoint}#${record.name}`,
          );
        }
      } else {
        typeCount += 1;
        if (!generatedHasRow(generated, entrypoint.entrypoint, record.name, "type")) {
          violations.push(
            `missing type in generated index: ${entrypoint.entrypoint}#${record.name}`,
          );
        }
      }
    }
    for (const [symbol, mapping] of Object.entries(mappings)) {
      if (!actualValues.has(symbol)) {
        violations.push(
          `stale mapping: ${entrypoint.entrypoint}#${symbol}`,
        );
        continue;
      }
      validateMapping(root, mapping, statuses, violations);
    }
  }

  for (const entrypoint of Object.keys(coverage.entrypoints ?? {})) {
    if (!api.entrypoints.some((candidate) => candidate.entrypoint === entrypoint)) {
      violations.push(`stale mapping entrypoint: ${entrypoint}`);
    }
  }

  return {
    violations: [...new Set(violations)],
    valueCount,
    typeCount,
    statusCount: statuses.size,
  };
}

function validateMapping(root, mapping, statuses, violations) {
  if (!mapping || typeof mapping !== "object") {
    violations.push("invalid coverage mapping record");
    return;
  }
  const reference = resolve(root, skillRoot, "references", mapping.reference ?? "");
  if (!mapping.reference || !existsSync(reference)) {
    violations.push(`missing reference file: ${mapping.reference ?? "missing"}`);
  } else {
    const content = readFileSync(reference, "utf8");
    if (!mapping.section || !content.includes(`## ${mapping.section}\n`)) {
      violations.push(
        `missing reference heading: ${mapping.reference}#${mapping.section ?? "missing"}`,
      );
    }
  }
  if (!mapping.capability || !statuses.has(mapping.capability)) {
    violations.push(`missing status: ${mapping.capability ?? "missing"}`);
  }
}

function parseStatuses(content, violations) {
  const statuses = new Map();
  for (const line of content.split("\n")) {
    if (!/^\| [a-z0-9-]+ \|/.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const [id, status] = cells;
    if (!id || !status) continue;
    if (id === "---") continue;
    if (!new Set(["verified", "experimental", "blocked"]).has(status)) {
      violations.push(`invalid status for ${id}: ${status}`);
      continue;
    }
    if (statuses.has(id)) {
      violations.push(`duplicate capability status: ${id}`);
      continue;
    }
    statuses.set(id, status);
  }
  return statuses;
}

function generatedHasRow(content, entrypoint, symbol, kind) {
  const heading = `## \`${entrypoint}\``;
  const start = content.indexOf(heading);
  if (start < 0) return false;
  const end = content.indexOf("\n## `", start + heading.length);
  const section = content.slice(start, end < 0 ? undefined : end);
  return section.includes(`| ${escapeTable(symbol)} | ${kind} |`);
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("`", "\\`");
}

function readCompatibleVersion(content) {
  return content.match(/Compatible package version:\s*`?([^`\s]+)`?/)?.[1];
}

function readText(root, path) {
  try {
    return readFileSync(resolve(root, path), "utf8");
  } catch (error) {
    throw new Error(`${path} could not be read: ${readError(error)}`);
  }
}

function readJson(root, path) {
  return JSON.parse(readText(root, path));
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseCli(argv) {
  let root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root" && argv[index + 1]) {
      root = resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error("Usage: check-api-coverage.mjs [--root <path>]");
    }
  }
  return root;
}

function main() {
  try {
    const result = checkApiCoverage(parseCli(process.argv.slice(2)));
    if (result.violations.length > 0) {
      for (const violation of result.violations) {
        process.stderr.write(`${violation}\n`);
      }
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `Viselora API coverage passed: ${result.valueCount} value exports, ${result.typeCount} type exports, ${result.statusCount} capability statuses\n`,
    );
  } catch (error) {
    process.stderr.write(`${readError(error)}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
