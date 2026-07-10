import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const IMPORT_PATTERN =
  /\b(?:import|export)\b[\s\S]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

const ALLOWED_PUBLIC_IMPORTS = new Set([
  "@viselora/dom-webgl",
  "@viselora/dom-webgl/react",
  "@viselora/scroll-adapters",
  "@viselora/scroll-adapters/react",
]);

const VISELORA_PACKAGE_PREFIXES = [
  "@viselora/dom-webgl/",
  "@viselora/scroll-adapters/",
];

const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);

export async function findExampleImportViolations({
  workspaceRoot = defaultWorkspaceRoot(),
  exampleSourceDir = path.join(workspaceRoot, "apps", "example", "src"),
} = {}) {
  const files = await collectSourceFiles(exampleSourceDir);
  const runtimeSourceDir = path.resolve(
    workspaceRoot,
    "packages",
    "dom-webgl-runtime",
    "src",
  );
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const specifier of collectImportSpecifiers(source)) {
      const violationReason = getViolationReason({
        specifier,
        file,
        exampleSourceDir,
        runtimeSourceDir,
      });
      if (!violationReason) {
        continue;
      }

      violations.push({
        file,
        specifier,
        reason: violationReason,
      });
    }
  }

  return violations;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }
    if (entry.name.includes(".test.")) {
      continue;
    }
    if (SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectImportSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function getViolationReason({
  specifier,
  file,
  exampleSourceDir,
  runtimeSourceDir,
}) {
  if (specifier.startsWith("@project/")) {
    return "legacy @project package import";
  }

  if (ALLOWED_PUBLIC_IMPORTS.has(specifier)) {
    return null;
  }

  if (VISELORA_PACKAGE_PREFIXES.some((prefix) => specifier.startsWith(prefix))) {
    return "non-public Viselora package import";
  }

  if (
    specifier === "packages/dom-webgl-runtime/src" ||
    specifier.startsWith("packages/dom-webgl-runtime/src/")
  ) {
    return "workspace runtime source import";
  }

  if (!specifier.startsWith(".")) {
    return null;
  }

  const resolved = path.resolve(path.dirname(file), specifier);
  if (isInside(resolved, runtimeSourceDir)) {
    return "relative import reaches runtime source";
  }
  if (isInside(resolved, exampleSourceDir)) {
    return null;
  }

  return null;
}

function isInside(candidatePath, parentPath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function defaultWorkspaceRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..");
}

function formatViolations(violations, workspaceRoot) {
  return violations.map(({ file, specifier, reason }) => {
    const relativeFile = path.relative(workspaceRoot, file) || file;
    return `${relativeFile}: ${specifier} (${reason})`;
  });
}

async function main() {
  const workspaceRoot = defaultWorkspaceRoot();
  const violations = await findExampleImportViolations({ workspaceRoot });

  if (violations.length === 0) {
    process.stdout.write("Example import boundary OK\n");
    return;
  }

  process.stderr.write("Example import boundary violations:\n");
  for (const line of formatViolations(violations, workspaceRoot)) {
    process.stderr.write(`- ${line}\n`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
