import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+-alpha\.\d+$/;

const releaseFiles = {
  runtime: "packages/dom-webgl-runtime/package.json",
  adapters: "packages/dom-webgl-scroll-adapters/package.json",
  app: "apps/example/package.json",
  skill: "skills/viselora-dom-webgl/SKILL.md",
  lockfile: "package-lock.json",
};

export function readReleaseVersions(root = process.cwd()) {
  return readState(readDocuments(root));
}

export function assertReleaseVersions(root = process.cwd(), expectedVersion) {
  const state = readReleaseVersions(root);
  const expected = expectedVersion ?? state.runtime;
  assertAlphaVersion(expected);
  const mismatches = Object.entries(state)
    .filter(([, version]) => version !== expected)
    .map(([surface, version]) => `${surface}=${String(version)}`);
  if (mismatches.length > 0) {
    throw new Error(
      `Release version mismatch; expected ${expected}: ${mismatches.join(", ")}`,
    );
  }
  return expected;
}

export function setReleaseVersion(root = process.cwd(), version) {
  assertAlphaVersion(version);
  const original = readDocuments(root);
  const next = prepareNextDocuments(original, version);
  const nextState = readState(next);
  const mismatches = Object.entries(nextState).filter(([, value]) => value !== version);
  if (mismatches.length > 0) {
    throw new Error(
      `Release version mismatch while preparing ${version}: ${mismatches
        .map(([surface, value]) => `${surface}=${String(value)}`)
        .join(", ")}`,
    );
  }

  const written = [];
  try {
    for (const [key, relativePath] of Object.entries(releaseFiles)) {
      writeFileSync(resolve(root, relativePath), next[key]);
      written.push(key);
    }
  } catch (error) {
    for (const key of written.reverse()) {
      writeFileSync(resolve(root, releaseFiles[key]), original[key]);
    }
    throw error;
  }

  return version;
}

export function assertAlphaVersion(version) {
  if (typeof version !== "string" || !RELEASE_VERSION_PATTERN.test(version)) {
    throw new Error(
      `Invalid release version ${String(version)}. Expected <major>.<minor>.<patch>-alpha.<number>`,
    );
  }
}

function readDocuments(root) {
  return Object.fromEntries(
    Object.entries(releaseFiles).map(([key, relativePath]) => {
      try {
        return [key, readFileSync(resolve(root, relativePath), "utf8")];
      } catch (error) {
        throw new Error(`Could not read ${relativePath}: ${readError(error)}`);
      }
    }),
  );
}

function prepareNextDocuments(documents, version) {
  const runtime = parseJson(documents.runtime, releaseFiles.runtime);
  const adapters = parseJson(documents.adapters, releaseFiles.adapters);
  const app = parseJson(documents.app, releaseFiles.app);
  const lockfile = parseJson(documents.lockfile, releaseFiles.lockfile);

  runtime.version = version;
  adapters.version = version;
  requireObject(adapters, "dependencies", releaseFiles.adapters)[
    "@viselora/dom-webgl"
  ] = version;
  const appDependencies = requireObject(app, "dependencies", releaseFiles.app);
  appDependencies["@viselora/dom-webgl"] = version;
  appDependencies["@viselora/scroll-adapters"] = version;

  const packages = requireObject(lockfile, "packages", releaseFiles.lockfile);
  const lockRuntime = requireObject(
    packages,
    "packages/dom-webgl-runtime",
    releaseFiles.lockfile,
  );
  const lockAdapters = requireObject(
    packages,
    "packages/dom-webgl-scroll-adapters",
    releaseFiles.lockfile,
  );
  const lockApp = requireObject(packages, "apps/example", releaseFiles.lockfile);
  lockRuntime.version = version;
  lockAdapters.version = version;
  requireObject(lockAdapters, "dependencies", releaseFiles.lockfile)[
    "@viselora/dom-webgl"
  ] = version;
  const lockAppDependencies = requireObject(
    lockApp,
    "dependencies",
    releaseFiles.lockfile,
  );
  lockAppDependencies["@viselora/dom-webgl"] = version;
  lockAppDependencies["@viselora/scroll-adapters"] = version;

  const compatibleVersionPattern = /(Compatible package version:\s*)(\S+)/;
  if (!compatibleVersionPattern.test(documents.skill)) {
    throw new Error(
      `${releaseFiles.skill} must declare "Compatible package version: <version>"`,
    );
  }

  return {
    runtime: formatJson(runtime),
    adapters: formatJson(adapters),
    app: formatJson(app),
    skill: documents.skill.replace(compatibleVersionPattern, `$1${version}`),
    lockfile: formatJson(lockfile),
  };
}

function readState(documents) {
  const runtime = parseJson(documents.runtime, releaseFiles.runtime);
  const adapters = parseJson(documents.adapters, releaseFiles.adapters);
  const app = parseJson(documents.app, releaseFiles.app);
  const lockfile = parseJson(documents.lockfile, releaseFiles.lockfile);
  const skill = documents.skill.match(/Compatible package version:\s*(\S+)/)?.[1];
  if (!skill) {
    throw new Error(
      `${releaseFiles.skill} must declare "Compatible package version: <version>"`,
    );
  }
  const packages = requireObject(lockfile, "packages", releaseFiles.lockfile);
  const lockRuntime = requireObject(
    packages,
    "packages/dom-webgl-runtime",
    releaseFiles.lockfile,
  );
  const lockAdapters = requireObject(
    packages,
    "packages/dom-webgl-scroll-adapters",
    releaseFiles.lockfile,
  );
  const lockApp = requireObject(packages, "apps/example", releaseFiles.lockfile);
  return {
    runtime: runtime.version,
    adapters: adapters.version,
    dependency: requireObject(adapters, "dependencies", releaseFiles.adapters)[
      "@viselora/dom-webgl"
    ],
    appRuntime: requireObject(app, "dependencies", releaseFiles.app)[
      "@viselora/dom-webgl"
    ],
    appAdapters: requireObject(app, "dependencies", releaseFiles.app)[
      "@viselora/scroll-adapters"
    ],
    skill,
    lockRuntime: lockRuntime.version,
    lockAdapters: lockAdapters.version,
    lockDependency: requireObject(
      lockAdapters,
      "dependencies",
      releaseFiles.lockfile,
    )["@viselora/dom-webgl"],
    lockAppRuntime: requireObject(
      lockApp,
      "dependencies",
      releaseFiles.lockfile,
    )["@viselora/dom-webgl"],
    lockAppAdapters: requireObject(
      lockApp,
      "dependencies",
      releaseFiles.lockfile,
    )["@viselora/scroll-adapters"],
  };
}

function parseJson(content, relativePath) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Could not parse ${relativePath}: ${readError(error)}`);
  }
}

function requireObject(parent, key, relativePath) {
  const value = parent?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${relativePath} is missing object ${key}`);
  }
  return value;
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}
