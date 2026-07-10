#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const exactVersion = "0.1.0-alpha.0";
const allowedViseloraImports = new Set([
  "@viselora/dom-webgl",
  "@viselora/dom-webgl/react",
  "@viselora/scroll-adapters",
  "@viselora/scroll-adapters/react",
]);
const sourcePattern = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const consumerRoot = resolve(process.argv[2] ?? process.cwd());
const violations = [];

verifyPackageJson();

const sourceFiles = collectSourceFiles(consumerRoot);
const sources = sourceFiles.map((file) => ({
  file,
  content: readFileSync(file, "utf8"),
}));
const combined = sources.map(({ content }) => content).join("\n");

verifyImports();
verifyRuntimeOwnership();
verifyStableEffects();
verifyInputOwnership();
verifyRecipeSurfaces();

if (violations.length > 0) {
  for (const violation of violations) {
    process.stderr.write(`${violation}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`Viselora consumer verification passed: ${consumerRoot}\n`);
}

function verifyPackageJson() {
  const packageJsonPath = resolve(consumerRoot, "package.json");
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    add(`package.json could not be read: ${readError(error)}`);
    return;
  }

  const versions = {
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.dependencies,
  };
  for (const packageName of [
    "@viselora/dom-webgl",
    "@viselora/scroll-adapters",
  ]) {
    if (versions[packageName] !== exactVersion) {
      add(`${packageName} must be pinned exactly ${exactVersion}`);
    }
  }
}

function verifyImports() {
  const importPattern = /(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g;
  for (const { file, content } of sources) {
    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1];
      if (specifier.startsWith("@project/")) {
        add(`${display(file)}: @project/* imports are prohibited`);
      }
      if (
        specifier.includes("packages/dom-webgl-runtime/src") ||
        specifier.includes("packages/dom-webgl-scroll-adapters/src")
      ) {
        add(`${display(file)}: repository source imports are prohibited`);
      }
      if (
        specifier.startsWith("@viselora/") &&
        !allowedViseloraImports.has(specifier)
      ) {
        add(`${display(file)}: non-public Viselora import ${specifier} is prohibited`);
      }
    }
  }
}

function verifyRuntimeOwnership() {
  const reactRoots = count(combined, /<WebGL(?:Scroll)?Runtime\b/g);
  const imperativeRoots = count(combined, /\bcreateWebGLRuntime\s*\(/g);
  if (reactRoots + imperativeRoots !== 1) {
    add("consumer must contain exactly one runtime root");
  }
  if (/\bnew\s+(?:THREE\.)?WebGLRenderer\s*\(/.test(combined)) {
    add("direct WebGLRenderer construction is prohibited");
  }
  if (/from\s*["']@react-three\/fiber["']/.test(combined)) {
    add("React Three Fiber is prohibited");
  }
  if (/<Canvas\b/.test(combined)) {
    add("R3F Canvas roots are prohibited");
  }
}

function verifyStableEffects() {
  const declarations = sources.flatMap(({ file, content }) =>
    [...content.matchAll(/\b(?:const|let|var)\s+runtimeEffects\s*=/g)].map(
      (match) => ({ file, content, index: match.index ?? 0 }),
    ),
  );
  if (declarations.length === 0) {
    add("a module-scope runtimeEffects array is required");
    return;
  }
  for (const declaration of declarations) {
    if (braceDepthAt(declaration.content, declaration.index) !== 0) {
      add(`${display(declaration.file)}: runtimeEffects must be declared at module scope`);
    }
  }
}

function verifyInputOwnership() {
  const directInput = /\baddEventListener\s*\(\s*["'](?:scroll|wheel|touchmove|pointer(?:move|down|up|cancel))["']/;
  const jsxInput = /\bon(?:Scroll|Wheel|TouchMove|PointerMove|PointerDown|PointerUp)\s*=/;
  if (directInput.test(combined) || jsxInput.test(combined)) {
    add("scroll and pointer input must use one managed ownership path");
  }
  if (
    /<WebGLScrollTimeline\b/.test(combined) &&
    !/\bScrollTrigger\s*=/.test(combined) &&
    !/<WebGLScrollRuntime\b[^>]*\bsmooth\s*=/.test(combined)
  ) {
    add("managed scroll timelines require one ScrollTrigger ownership path");
  }
}

function verifyRecipeSurfaces() {
  requireEvidence(
    /kind:\s*["']viselora\.surfacePulse["']/,
    "missing dom/element surface pulse surface",
  );
  if (
    !/type:\s*["']video["']/.test(combined) ||
    !/kind:\s*["']viselora\.videoBackground["']/.test(combined) ||
    !/ctx\.object\.texture/.test(combined) ||
    !/ctx\.object\.video/.test(combined)
  ) {
    add("missing media/video surface");
  }
  if (
    !/pointer:\s*\{\s*hover:\s*true\s*\}/.test(combined) ||
    !/kind:\s*["']viselora\.imageHoverOverlay["']/.test(combined) ||
    !/createMaterialLayer\s*\(/.test(combined)
  ) {
    add("missing pointer-hover surface");
  }
  if (
    !sources.some(
      ({ content }) =>
        /type:\s*["']glb["']/.test(content) &&
        /kind:\s*["']viselora\.modelGlow["']/.test(content),
    ) ||
    !/<WebGLScrollTimeline\b[\s\S]*?\bpin\b/.test(combined) ||
    !/\.emissive\.set\s*\(/.test(combined) ||
    !/\.lights\?\.point\s*\(/.test(combined) ||
    !/\.animation\?\.scrub\s*\(/.test(combined)
  ) {
    add("missing pinned model glow surface");
  }
  if (
    !/type:\s*["']image-sequence["']/.test(combined) ||
    !/kind:\s*["']viselora\.imageSequence["']/.test(combined) ||
    !/progressKey:\s*sharedProgressKey/.test(combined)
  ) {
    add("missing media/image-sequence surface");
  }
}

function requireEvidence(pattern, message) {
  if (!pattern.test(combined)) add(message);
}

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const path = resolve(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(path));
    } else if (sourcePattern.test(entry)) {
      files.push(path);
    }
  }
  return files.sort();
}

function braceDepthAt(content, end) {
  let depth = 0;
  let quote = undefined;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < end; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
    } else if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
    } else if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
    }
  }
  return depth;
}

function count(content, pattern) {
  return [...content.matchAll(pattern)].length;
}

function display(file) {
  return relative(consumerRoot, file) || file;
}

function add(message) {
  if (!violations.includes(message)) violations.push(message);
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}
