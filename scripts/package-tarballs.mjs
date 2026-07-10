import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const EXPECTED_PACKAGE_FILES = Object.freeze([
  "LICENSE",
  "README.md",
  "dist/index.d.ts",
  "dist/index.js",
  "dist/index.js.map",
  "dist/react.d.ts",
  "dist/react.js",
  "dist/react.js.map",
  "package.json",
]);

export function assertPackageFileList(files) {
  const actual = [...files]
    .map((file) => (typeof file === "string" ? file : file?.path))
    .filter((file) => typeof file === "string")
    .sort();
  const expected = [...EXPECTED_PACKAGE_FILES].sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const unexpected = actual.filter((file) => !expected.includes(file));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      [
        missing.length > 0 ? `Missing package files: ${missing.join(", ")}` : "",
        unexpected.length > 0
          ? `Unexpected package files: ${unexpected.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (actual.length !== expected.length) {
    throw new Error(
      `Unexpected duplicate package files: expected ${expected.length}, received ${actual.length}`,
    );
  }
  return actual;
}

export function parsePackJson(output) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    throw new Error(`Invalid npm pack --json output: ${readError(error)}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error("Invalid npm pack --json output: expected one package result");
  }
  const result = parsed[0];
  if (
    !result ||
    typeof result !== "object" ||
    typeof result.name !== "string" ||
    typeof result.version !== "string" ||
    typeof result.filename !== "string" ||
    typeof result.integrity !== "string" ||
    typeof result.shasum !== "string" ||
    !Array.isArray(result.files)
  ) {
    throw new Error("Invalid npm pack --json output: incomplete package result");
  }
  assertPackageFileList(result.files);
  return result;
}

export function packAndVerifyPackage(packageDirectory, destination) {
  const packageRoot = resolve(packageDirectory);
  const packDestination = resolve(destination);
  mkdirSync(packDestination, { recursive: true });
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npmCommand,
    ["pack", "--json", "--pack-destination", packDestination],
    {
      cwd: packageRoot,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `npm pack --json failed for ${packageRoot}: ${result.stderr || result.stdout}`,
    );
  }
  const metadata = parsePackJson(result.stdout);
  return {
    ...metadata,
    packageDirectory: packageRoot,
    tarballPath: resolve(packDestination, basename(metadata.filename)),
  };
}

export function createVerifiedTarballs(root = process.cwd()) {
  const directory = mkdtempSync(join(tmpdir(), "viselora-pack-"));
  try {
    const packages = [
      packAndVerifyPackage(
        resolve(root, "packages/dom-webgl-runtime"),
        directory,
      ),
      packAndVerifyPackage(
        resolve(root, "packages/dom-webgl-scroll-adapters"),
        directory,
      ),
    ];
    return {
      directory,
      packages,
      cleanup() {
        rmSync(directory, { force: true, recursive: true });
      },
    };
  } catch (error) {
    rmSync(directory, { force: true, recursive: true });
    throw error;
  }
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}
