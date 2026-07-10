import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { createVerifiedTarballs } from "./package-tarballs.mjs";
import {
  assertAlphaVersion,
  assertReleaseVersions,
} from "./release-version.mjs";

const PACKAGE_ORDER = Object.freeze([
  "@viselora/dom-webgl",
  "@viselora/scroll-adapters",
]);
const EXPECTED_EXPORTS = Object.freeze({
  ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
  "./react": { types: "./dist/react.d.ts", import: "./dist/react.js" },
});
const DEFAULT_READBACK_DELAYS = Object.freeze([
  10_000,
  20_000,
  30_000,
  30_000,
  30_000,
  30_000,
  30_000,
  30_000,
]);

export function publishRelease({
  root = process.cwd(),
  version,
  runCommand = runCommandSync,
  createTarballs = createVerifiedTarballs,
  log = console.log,
} = {}) {
  const repositoryRoot = resolve(root);
  assertAlphaVersion(version);
  assertReleaseVersions(repositoryRoot, version);

  const tarballs = createTarballs(repositoryRoot);
  try {
    const packages = tarballs.packages.map((packed) => ({
      name: packed.name,
      integrity: packed.integrity,
      tarballPath: packed.tarballPath,
      manifest: readManifest(packed.packageDirectory),
    }));
    return publishPackages({ version, packages, runCommand, log });
  } finally {
    tarballs.cleanup();
  }
}

export function publishPackages({
  version,
  packages,
  runCommand,
  log = () => {},
  readbackDelays = DEFAULT_READBACK_DELAYS,
  sleep = sleepSync,
}) {
  assertAlphaVersion(version);
  assertPackageOrder(packages);
  if (typeof runCommand !== "function") {
    throw new Error("Release publisher requires a command runner");
  }

  for (const entry of packages) {
    assertLocalPackage(entry, version);
  }

  const registryState = packages.map((entry) => {
    const published = readPublishedVersion(entry.name, version, runCommand);
    if (published) {
      assertPublishedMetadata(published, entry, version);
    }
    return { entry, published };
  });

  const actions = [];
  for (const { entry, published } of registryState) {
    if (published) {
      actions.push({ name: entry.name, action: "skipped" });
      continue;
    }
    const publishResult = runNpm(
      [
        "publish",
        entry.tarballPath,
        "--access",
        "public",
        "--tag",
        "alpha",
        "--provenance",
      ],
      runCommand,
      `publish ${entry.name}@${version}`,
    );
    const publishOutput = [publishResult.stdout, publishResult.stderr]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n")
      .trim();
    if (publishOutput) log(publishOutput);
    const confirmation = `+ ${entry.name}@${version}`;
    if (!publishOutput.includes(confirmation)) {
      throw new Error(
        `npm publish output did not confirm ${entry.name}@${version}: ${publishOutput || "<empty output>"}`,
      );
    }
    actions.push({ name: entry.name, action: "published" });
  }

  for (const entry of packages) {
    const published = readPublishedVersionWithRetry({
      name: entry.name,
      version,
      runCommand,
      readbackDelays,
      sleep,
      log,
    });
    if (!published) {
      throw new Error(`Registry mismatch: ${entry.name}@${version} is missing after release`);
    }
    assertPublishedMetadata(published, entry, version);
    let tags = runNpmJson(
      ["view", entry.name, "dist-tags", "--json"],
      runCommand,
      `read ${entry.name} dist-tags`,
    );
    if (typeof tags?.latest === "string" && /-alpha\.\d+$/.test(tags.latest)) {
      const removal = runNpm(
        ["dist-tag", "rm", entry.name, "latest"],
        runCommand,
        `remove prerelease latest tag from ${entry.name}`,
      );
      const removalOutput = [removal.stdout, removal.stderr]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join("\n")
        .trim();
      if (removalOutput) log(removalOutput);
      tags = runNpmJson(
        ["view", entry.name, "dist-tags", "--json"],
        runCommand,
        `verify ${entry.name} dist-tags after latest removal`,
      );
    }
    if (tags?.alpha !== version) {
      throw new Error(
        `Registry mismatch: ${entry.name} dist-tags.alpha is ${String(tags?.alpha)}, expected ${version}`,
      );
    }
    if (typeof tags?.latest === "string" && /-alpha\.\d+$/.test(tags.latest)) {
      throw new Error(
        `Registry mismatch: ${entry.name} dist-tags.latest must not reference prerelease ${tags.latest}`,
      );
    }
  }

  return actions;
}

function readPublishedVersionWithRetry({
  name,
  version,
  runCommand,
  readbackDelays,
  sleep,
  log,
}) {
  let published = readPublishedVersion(name, version, runCommand);
  for (const delay of readbackDelays) {
    if (published) return published;
    log(`Registry readback pending for ${name}@${version}; retrying in ${delay}ms`);
    sleep(delay);
    published = readPublishedVersion(name, version, runCommand);
  }
  return published;
}

function readPublishedVersion(name, version, runCommand) {
  const result = runCommand("npm", ["view", `${name}@${version}`, "--json"]);
  if (result?.status === 0) return parseJson(result.stdout, `${name}@${version}`);
  const errorText = `${result?.stderr ?? ""}\n${result?.stdout ?? ""}`;
  if (/\bE404\b|\b404\b.*not found/i.test(errorText)) return undefined;
  throw new Error(
    `npm view failed for ${name}@${version}: ${errorText.trim() || `exit ${String(result?.status)}`}`,
  );
}

function assertPublishedMetadata(published, entry, version) {
  if (published?.version !== version) {
    throw new Error(
      `Registry metadata mismatch for ${entry.name}: version ${String(published?.version)} != ${version}`,
    );
  }
  if (published?.dist?.integrity !== entry.integrity) {
    throw new Error(
      `Registry integrity mismatch for ${entry.name}@${version}: ${String(published?.dist?.integrity)} != ${entry.integrity}`,
    );
  }
  if (!equalJson(published.exports, entry.manifest.exports)) {
    throw new Error(`Registry exports mismatch for ${entry.name}@${version}`);
  }
  const expectedDependency = entry.manifest.dependencies?.["@viselora/dom-webgl"];
  if (expectedDependency !== undefined) {
    const actualDependency = published.dependencies?.["@viselora/dom-webgl"];
    if (actualDependency !== expectedDependency) {
      throw new Error(
        `Registry dependency mismatch for ${entry.name}@${version}: ${String(actualDependency)} != ${expectedDependency}`,
      );
    }
  }
}

function assertLocalPackage(entry, version) {
  if (entry.manifest?.name !== entry.name) {
    throw new Error(`Local package name mismatch for ${String(entry.name)}`);
  }
  if (entry.manifest.version !== version) {
    throw new Error(
      `Local package version mismatch for ${entry.name}: ${String(entry.manifest.version)} != ${version}`,
    );
  }
  if (entry.manifest.type !== "module") {
    throw new Error(`Local package type mismatch for ${entry.name}: expected module`);
  }
  if (!equalJson(entry.manifest.exports, EXPECTED_EXPORTS)) {
    throw new Error(`Local package exports mismatch for ${entry.name}`);
  }
  if (
    entry.name === "@viselora/scroll-adapters" &&
    entry.manifest.dependencies?.["@viselora/dom-webgl"] !== version
  ) {
    throw new Error(
      `Local package dependency mismatch for ${entry.name}: expected @viselora/dom-webgl=${version}`,
    );
  }
  if (!isAbsolute(entry.tarballPath)) {
    throw new Error(`Release tarball must be absolute for ${entry.name}`);
  }
  if (typeof entry.integrity !== "string" || !entry.integrity.startsWith("sha512-")) {
    throw new Error(`Release tarball integrity is missing for ${entry.name}`);
  }
}

function assertPackageOrder(packages) {
  const names = packages?.map((entry) => entry.name);
  if (!equalJson(names, PACKAGE_ORDER)) {
    throw new Error(
      `Release package order mismatch: expected ${PACKAGE_ORDER.join(" then ")}`,
    );
  }
}

function runNpmJson(args, runCommand, purpose) {
  const result = runNpm(args, runCommand, purpose);
  return parseJson(result.stdout, purpose);
}

function runNpm(args, runCommand, purpose) {
  const result = runCommand("npm", args);
  if (result?.status !== 0) {
    throw new Error(
      `npm command failed while attempting to ${purpose}: ${result?.stderr || result?.stdout || `exit ${String(result?.status)}`}`,
    );
  }
  return result;
}

function runCommandSync(command, args) {
  const executable =
    command === "npm" && process.platform === "win32" ? "npm.cmd" : command;
  return spawnSync(executable, args, { encoding: "utf8" });
}

function sleepSync(milliseconds) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)),
    0,
    0,
    milliseconds,
  );
}

function readManifest(packageDirectory) {
  const path = resolve(packageDirectory, "package.json");
  return parseJson(readFileSync(path, "utf8"), path);
}

function parseJson(content, label) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid JSON while attempting to read ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function equalJson(left, right) {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
}
