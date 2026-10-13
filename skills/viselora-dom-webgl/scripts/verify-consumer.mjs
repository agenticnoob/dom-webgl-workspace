#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const consumerRoot = resolve(process.argv[2] ?? process.cwd());
const violations = [];
const publicEntrypoints = new Set([
  "@viselora/dom-webgl",
  "@viselora/dom-webgl/react",
  "@viselora/scroll-adapters",
  "@viselora/scroll-adapters/react",
]);
const skill = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
const version = skill.match(/Compatible package version:\s*([^\s`]+)/)?.[1];
if (!version) throw new Error("SKILL.md has no compatible package version");

const pkg = readJson(resolve(consumerRoot, "package.json"));
const dependencies = { ...pkg?.devDependencies, ...pkg?.dependencies };
for (const [name, prefix] of [
  ["react", "19"],
  ["react-dom", "19"],
  ["@react-three/fiber", "9"],
  ["three", "0.184"],
]) {
  const declared = dependencies[name];
  if (
    typeof declared !== "string" ||
    !new RegExp(`^[~^]?${prefix.replaceAll(".", "\\.")}\\.`).test(declared)
  ) {
    violations.push(`${name} must declare a supported ${prefix}.x dependency`);
  }
}
validatePackage("@viselora/dom-webgl", true);
validatePackage("@viselora/scroll-adapters", false);

let ts;
try {
  ts = createRequire(resolve(consumerRoot, "package.json"))("typescript");
} catch {
  try {
    ts = createRequire(import.meta.url)("typescript");
  } catch {
    violations.push(
      "Install TypeScript in the consumer before running this static verifier",
    );
  }
}

const sourceFiles = ["src", "app", "pages"].flatMap((name) =>
  collect(resolve(consumerRoot, name)),
);
if (!sourceFiles.length)
  violations.push(
    "No JavaScript or TypeScript source found in src, app or pages",
  );
if (ts) for (const path of sourceFiles) inspectSource(path);

const manifestPath = resolve(consumerRoot, "viselora.capabilities.json");
if (existsSync(manifestPath)) {
  const manifest = readJson(manifestPath);
  const status = readFileSync(
    resolve(skillRoot, "references/capability-status.md"),
    "utf8",
  );
  const known = new Set(
    [...status.matchAll(/^\| ([a-z][a-z0-9-]*) \|/gm)].map((match) => match[1]),
  );
  if (manifest?.schemaVersion !== 2)
    violations.push("Capability manifest schemaVersion must be 2");
  if (manifest?.compatiblePackageVersion !== version)
    violations.push(`Capability manifest version must be ${version}`);
  if (!Array.isArray(manifest?.capabilities)) {
    violations.push("Capability manifest requires a capabilities array");
  } else {
    const selected = new Set();
    for (const id of manifest.capabilities) {
      if (!known.has(id)) violations.push(`Unknown capability: ${String(id)}`);
      if (selected.has(id))
        violations.push(`Duplicate capability: ${String(id)}`);
      selected.add(id);
    }
  }
}

if (violations.length) {
  console.error(violations.map((message) => `- ${message}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Viselora static consumer contract verification passed.");
  console.log(
    "Browser rendering, one mounted Canvas, asset cleanup and visual correctness still require runtime verification.",
  );
}

function validatePackage(name, required) {
  const declared = dependencies[name];
  if (!declared && !required) return;
  if (
    declared !== version &&
    !(typeof declared === "string" && /^file:.*\.tgz$/.test(declared))
  ) {
    violations.push(
      `${name} must use ${version} or its reviewed local tarball`,
    );
  }
  const installedPath = resolve(
    consumerRoot,
    "node_modules",
    name,
    "package.json",
  );
  if (
    existsSync(installedPath) &&
    readJson(installedPath)?.version !== version
  ) {
    violations.push(`Installed ${name} version must be ${version}`);
  }
}

function inspectSource(path) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const rendererNames = new Set();
  const canvasNames = new Set();
  const fiberNamespaces = new Set();
  const threeNamespaces = new Set();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const name = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      if (name === "three") threeNamespaces.add(bindings.name.text);
      if (name === "@react-three/fiber")
        fiberNamespaces.add(bindings.name.text);
    }
    if (bindings && ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        if (specifier.isTypeOnly || statement.importClause?.isTypeOnly)
          continue;
        const imported = (specifier.propertyName ?? specifier.name).text;
        if (name === "three" && imported === "WebGLRenderer")
          rendererNames.add(specifier.name.text);
        if (
          name === "@react-three/fiber" &&
          ["Canvas", "createRoot"].includes(imported)
        )
          canvasNames.add(specifier.name.text);
      }
    }
  }

  visit(source);
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      inspectImport(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")
      ) {
        inspectImport(node.arguments[0].text);
      }
    }
    if (
      ts.isNewExpression(node) &&
      isOwnedConstructor(
        node.expression,
        rendererNames,
        threeNamespaces,
        "WebGLRenderer",
      )
    ) {
      report(
        "WebGLRuntime owns the renderer; do not construct another WebGLRenderer",
      );
    }
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      isOwnedConstructor(node.tagName, canvasNames, fiberNamespaces, "Canvas")
    ) {
      report(
        "WebGLRuntime owns the Canvas; place R3F components in its scene prop",
      );
    }
    if (ts.isCallExpression(node)) {
      if (
        isOwnedConstructor(
          node.expression,
          canvasNames,
          fiberNamespaces,
          "createRoot",
        )
      ) {
        report("WebGLRuntime owns the R3F root; do not create another root");
      }
      if (
        node.arguments.some((argument) =>
          isOwnedConstructor(argument, canvasNames, fiberNamespaces, "Canvas"),
        )
      ) {
        report(
          "WebGLRuntime owns the Canvas; place R3F components in its scene prop",
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  function inspectImport(name) {
    if (
      (name.startsWith("@viselora/") && !publicEntrypoints.has(name)) ||
      /(?:^|\/)packages\/[^/]+\/src(?:\/|$)/.test(name)
    ) {
      report(`Use a public Viselora entrypoint instead of ${name}`);
    }
  }
  function report(message) {
    violations.push(`${relative(consumerRoot, path)}: ${message}`);
  }
}

function isOwnedConstructor(node, names, namespaces, member) {
  return (
    (ts.isIdentifier(node) && names.has(node.text)) ||
    (ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      namespaces.has(node.expression.text) &&
      node.name.text === member)
  );
}

function collect(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    if (["node_modules", ".next", "dist"].includes(name)) return [];
    const path = resolve(directory, name);
    return statSync(path).isDirectory()
      ? collect(path)
      : /\.[cm]?[jt]sx?$/.test(name)
        ? [path]
        : [];
  });
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    violations.push(`${relative(consumerRoot, path)}: ${error.message}`);
    return undefined;
  }
}
