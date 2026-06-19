import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const IMPORT_PATTERN =
  /\b(?:import|export)\b[\s\S]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

const ALLOWED_PUBLIC_IMPORTS = new Set([
  "@project/dom-webgl-runtime",
  "@project/dom-webgl-runtime/effects",
  "@project/dom-webgl-runtime/react",
]);

const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);

export async function findDemoImportViolations({
  workspaceRoot = defaultWorkspaceRoot(),
  demoSourceDir = path.join(workspaceRoot, "apps", "demo", "src"),
} = {}) {
  const files = await collectSourceFiles(demoSourceDir);
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
        demoSourceDir,
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

function getViolationReason({ specifier, file, demoSourceDir, runtimeSourceDir }) {
  if (specifier.startsWith("@project/dom-webgl-runtime/")) {
    return ALLOWED_PUBLIC_IMPORTS.has(specifier) ? null : "non-public runtime alias import";
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
  if (isInside(resolved, demoSourceDir)) {
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
  const violations = await findDemoImportViolations({ workspaceRoot });

  if (violations.length === 0) {
    process.stdout.write("Demo import boundary OK\n");
    return;
  }

  process.stderr.write("Demo import boundary violations:\n");
  for (const line of formatViolations(violations, workspaceRoot)) {
    process.stderr.write(`- ${line}\n`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
