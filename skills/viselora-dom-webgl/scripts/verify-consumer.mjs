#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exactVersion = "0.1.0-alpha.0";
const allowedViseloraImports = new Set([
  "@viselora/dom-webgl",
  "@viselora/dom-webgl/react",
  "@viselora/scroll-adapters",
  "@viselora/scroll-adapters/react",
]);
const sourcePattern = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const consumerRoot = resolve(process.argv[2] ?? process.cwd());
const packageJsonPath = resolve(consumerRoot, "package.json");
const skillRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const violations = [];
const capabilityRequirements = {
  "public-imports-ssr": {
    requiredChecks: ["browser-public-imports", "ssr-public-imports"],
    assetKinds: [],
  },
  "single-runtime-canvas": {
    requiredChecks: ["one-canvas-mounted", "unmount-remount-1-0-1"],
    assetKinds: [],
  },
  "runtime-remount": {
    requiredChecks: ["unmount-remount-1-0-1", "disposed-resources-released"],
    assetKinds: [],
  },
  "managed-image-hover": {
    requiredChecks: [
      "final-canvas-pixel-change",
      "touch-or-scroll-alternative",
      "loading-error-fallback",
    ],
    assetKinds: ["image"],
  },
  "managed-video": {
    requiredChecks: [
      "playback",
      "autoplay-rejection-fallback",
      "network-error-fallback",
      "offscreen-reentry",
    ],
    assetKinds: ["video"],
  },
  "shared-scroll-progress": {
    requiredChecks: [
      "slow-forward-scroll",
      "fast-forward-scroll",
      "reverse-scroll",
    ],
    assetKinds: [],
  },
  "resource-fallback-lifecycle": {
    requiredChecks: [
      "loading-fallback",
      "network-error-fallback",
      "offscreen-reentry",
    ],
    assetKinds: [],
  },
  "glb-loading-lifecycle": {
    requiredChecks: [
      "glb-ready-active",
      "glb-network-error-fallback",
      "offscreen-reentry",
    ],
    assetKinds: ["model"],
  },
  "reduced-motion-signaling": {
    requiredChecks: [
      "reduced-motion-content-continuity",
      "reduced-motion-no-required-animation",
    ],
    assetKinds: [],
  },
  "image-sequence": {
    requiredChecks: [
      "final-canvas-pixel-change",
      "first-frame-fallback",
      "bounded-cache",
      "forward-reverse-scroll",
    ],
    assetKinds: ["image-sequence"],
  },
  "scene-camera-pass": {
    requiredChecks: [
      "scene-camera-pass-declarations",
      "clipped-final-canvas-pixel-change",
    ],
    assetKinds: [],
  },
  "scene-native-models": {
    requiredChecks: [
      "model-asset-ready",
      "scene-model-final-canvas-pixel-change",
    ],
    assetKinds: ["model"],
  },
  "scene-object-effect-registration": {
    requiredChecks: [
      "root-defined-scene-object-effect",
      "react-scene-object-consumer",
      "model-ready-attached",
      "clean-browser-errors",
      "final-canvas-pixel-change",
    ],
    assetKinds: [],
  },
  "scene-object-interaction": {
    requiredChecks: [
      "managed-picking",
      "pointer-touch-alternative",
      "interaction-final-canvas-pixel-change",
    ],
    assetKinds: [],
  },
  "camera-gestures": {
    requiredChecks: [
      "managed-camera-controller",
      "mobile-gesture-alternative",
      "camera-persistence-after-release",
    ],
    assetKinds: [],
  },
  physics: {
    requiredChecks: [
      "managed-physics-descriptors",
      "direct-drag-release-inertia",
      "fallback-without-physics",
    ],
    assetKinds: [],
  },
  "advanced-effect-facades": {
    requiredChecks: [
      "public-facade-only",
      "effect-resource-disposal",
      "final-canvas-pixel-change",
    ],
    assetKinds: [],
  },
  "surface-pulse-visible-output": {
    requiredChecks: [
      "retained-surface-pulse-reproduction",
      "effect-surface-pixels-change",
      "final-canvas-pixel-threshold",
    ],
    assetKinds: [],
  },
  "dom-anchored-glb-visible-output": {
    requiredChecks: [
      "retained-dom-glb-reproduction",
      "glb-ready-active",
      "final-canvas-pixel-threshold",
    ],
    assetKinds: ["model"],
  },
};

verifyPackageJson();
const capabilityStatuses = readCapabilityStatus();
const capabilityManifest = readCapabilityManifest();
const selectedCapabilities = validateCapabilitySelection(
  capabilityManifest,
  capabilityStatuses,
);
const assetManifest = readAssetManifest(capabilityManifest);
validateSelectedAssets(selectedCapabilities, assetManifest);

const ts = loadConsumerTypeScript();
if (ts) {
  verifyWithTypeScript(ts, selectedCapabilities);
}

if (violations.length > 0) {
  for (const violation of violations) {
    process.stderr.write(`${violation}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("Viselora static consumer contract verification passed.\n");
  process.stdout.write("Real-browser evidence was not executed by this verifier.\n");
}

function readCapabilityManifest() {
  return readJsonFile(
    resolve(consumerRoot, "viselora.capabilities.json"),
    "viselora.capabilities.json",
  );
}

function readCapabilityStatus() {
  const path = resolve(skillRoot, "references/capability-status.md");
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    add(`capability status could not be read: ${readError(error)}`);
    return new Map();
  }
  const version = content.match(/Compatible package version:\s*`?([^`\s]+)`?/)?.[1];
  if (version !== exactVersion) {
    add(`capability status compatible version must be ${exactVersion}`);
  }
  const statuses = new Map();
  for (const line of content.split("\n")) {
    if (!/^\| [a-z0-9-]+ \| (?:verified|experimental|blocked) \|/.test(line)) {
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    statuses.set(cells[0], cells[1]);
  }
  return statuses;
}

function validateCapabilitySelection(manifest, statuses) {
  if (!manifest) return [];
  if (manifest.schemaVersion !== 1) {
    add("viselora.capabilities.json schemaVersion must be 1");
  }
  if (manifest.compatiblePackageVersion !== exactVersion) {
    add(`compatiblePackageVersion must be exactly ${exactVersion}`);
  }
  if (!new Set(["consumer", "retained-defect-reproduction"]).has(manifest.mode)) {
    add("capability manifest mode must be consumer or retained-defect-reproduction");
  }
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    add("capability manifest must contain non-empty capabilities");
    return [];
  }

  const selected = [];
  const ids = new Set();
  const knownChecks = new Set(
    Object.values(capabilityRequirements).flatMap(
      (requirement) => requirement.requiredChecks,
    ),
  );
  for (const entry of manifest.capabilities) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string") {
      add("capability entries require a string id");
      continue;
    }
    if (ids.has(entry.id)) {
      add(`duplicate capability: ${entry.id}`);
      continue;
    }
    ids.add(entry.id);
    const status = statuses.get(entry.id);
    const requirement = capabilityRequirements[entry.id];
    if (!status || !requirement) {
      add(`unknown capability: ${entry.id}`);
      continue;
    }
    if (status === "experimental" && entry.acknowledgement !== "experimental") {
      add(`[${entry.id}] experimental capability requires acknowledgement: experimental`);
    }
    if (status === "experimental") {
      validateBrowserPreflight(entry);
    }
    if (
      status === "blocked" &&
      (manifest.mode !== "retained-defect-reproduction" ||
        entry.acknowledgement !== "blocked-defect-reproduction")
    ) {
      add(
        `[${entry.id}] blocked capability requires retained-defect-reproduction mode and acknowledgement: blocked-defect-reproduction`,
      );
    }
    const checks = Array.isArray(entry.checks) ? entry.checks : [];
    for (const check of checks) {
      if (!knownChecks.has(check)) {
        add(`[${entry.id}] unknown check: ${check}`);
      }
    }
    for (const check of requirement.requiredChecks) {
      if (!checks.includes(check)) {
        add(`[${entry.id}] missing required check: ${check}`);
      }
    }
    selected.push({ ...entry, status, requirement });
  }
  return selected;
}

function validateBrowserPreflight(entry) {
  if (
    !entry.preflight ||
    entry.preflight.status !== "browser-passed" ||
    typeof entry.preflight.evidence !== "string"
  ) {
    add(`[${entry.id}] experimental capability requires browser-passed preflight evidence`);
    return;
  }
  const absolute = resolve(consumerRoot, entry.preflight.evidence);
  const relativePath = relative(consumerRoot, absolute);
  if (relativePath.startsWith("..") || relativePath === "") {
    add(`[${entry.id}] preflight evidence must be inside the consumer root`);
    return;
  }
  const evidence = readJsonFile(
    absolute,
    entry.preflight.evidence,
    `[${entry.id}] preflight evidence`,
  );
  if (!evidence) return;
  if (evidence.packageVersion !== exactVersion) {
    add(`[${entry.id}] preflight packageVersion must be ${exactVersion}`);
  }
  if (evidence.capabilityId !== entry.id) {
    add(`[${entry.id}] preflight capabilityId mismatch`);
  }
  if (evidence.passed !== true) {
    add(`[${entry.id}] preflight passed must be true`);
  }
  if (!Array.isArray(evidence.consoleErrors) || evidence.consoleErrors.length > 0) {
    add(`[${entry.id}] preflight consoleErrors must be an empty array`);
  }
  if (!Array.isArray(evidence.pageErrors) || evidence.pageErrors.length > 0) {
    add(`[${entry.id}] preflight pageErrors must be an empty array`);
  }
  const measurements = evidence.measurements;
  if (
    !measurements ||
    typeof measurements !== "object" ||
    !Object.values(measurements).some(
      (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
    )
  ) {
    add(`[${entry.id}] preflight requires a positive direct measurement`);
  }
}

function readAssetManifest(manifest) {
  if (!manifest || typeof manifest.assetManifest !== "string") {
    add("capability manifest requires assetManifest");
    return undefined;
  }
  const absolute = resolve(consumerRoot, manifest.assetManifest);
  const relativePath = relative(consumerRoot, absolute);
  if (relativePath.startsWith("..") || relativePath === "") {
    add("assetManifest must be a relative file inside the consumer root");
    return undefined;
  }
  return readJsonFile(absolute, manifest.assetManifest);
}

function validateSelectedAssets(selected, manifest) {
  if (!manifest) return;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
    add("asset-manifest.json must use schemaVersion 1 and an assets array");
    return;
  }
  for (const capability of selected) {
    for (const kind of capability.requirement.assetKinds) {
      if (!manifest.assets.some((asset) => asset?.kind === kind)) {
        add(`[${capability.id}] missing ${kind} asset record`);
      }
    }
  }
  for (const asset of manifest.assets) {
    validateAssetRecord(asset);
  }
}

function validateAssetRecord(asset) {
  if (!asset || typeof asset !== "object") {
    add("asset record must be an object");
    return;
  }
  for (const field of ["id", "kind", "localPath", "purpose", "source", "modifications", "metadata", "fallback"]) {
    if (asset[field] === undefined) add(`asset record missing ${field}`);
  }
  if (/^https?:\/\//.test(asset.localPath ?? "")) {
    add(`asset ${asset.id ?? "unknown"} localPath must be local, not a hotlink`);
  }
  for (const field of ["url", "author", "license", "deploymentRights"]) {
    if (asset.source?.[field] === undefined) {
      add(`asset ${asset.id ?? "unknown"} source missing ${field}`);
    }
  }
  if (asset.source?.deploymentRights === "local-validation-only") {
    add(`asset ${asset.id ?? "unknown"} is local-validation-only`);
  }
  if (asset.kind === "video" && !asset.metadata?.poster && !asset.fallback?.poster) {
    add(`asset ${asset.id ?? "unknown"} video requires a poster fallback`);
  }
  if (asset.kind === "image-sequence") {
    for (const field of ["frameCount", "pattern", "startFrame", "progressRange", "firstFrame", "cacheBudget"]) {
      if (asset.metadata?.[field] === undefined) {
        add(`asset ${asset.id ?? "unknown"} image-sequence metadata missing ${field}`);
      }
    }
  }
  if (asset.kind === "model" && !asset.fallback?.localPath && !asset.fallback?.text) {
    add(`asset ${asset.id ?? "unknown"} model requires poster or text fallback`);
  }
}

function readJsonFile(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    add(`${label} could not be read: ${readError(error)}`);
    return undefined;
  }
}

function verifyPackageJson() {
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    add(`package.json could not be read: ${readError(error)}`);
    return;
  }

  for (const packageName of [
    "@viselora/dom-webgl",
    "@viselora/scroll-adapters",
  ]) {
    const declaredVersions = [
      packageJson.dependencies?.[packageName],
      packageJson.devDependencies?.[packageName],
      packageJson.peerDependencies?.[packageName],
    ].filter((version) => version !== undefined);
    if (
      declaredVersions.length !== 1 ||
      declaredVersions[0] !== exactVersion
    ) {
      add(`${packageName} must be pinned exactly ${exactVersion}`);
    }
  }
}

function loadConsumerTypeScript() {
  try {
    const consumerRequire = createRequire(packageJsonPath);
    return consumerRequire("typescript");
  } catch (error) {
    add(
      `TypeScript compiler API is unavailable from the consumer project; install its declared typescript dependency (${readError(error)})`,
    );
    return undefined;
  }
}

function verifyWithTypeScript(ts, selectedCapabilities) {
  const sourcePaths = collectSourceFiles(consumerRoot);
  const program = ts.createProgram({
    rootNames: sourcePaths,
    options: {
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noLib: true,
      noEmit: true,
      noResolve: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const checker = program.getTypeChecker();
  const records = sourcePaths
    .map((file) => ({ file, sourceFile: program.getSourceFile(file) }))
    .filter((record) => record.sourceFile !== undefined);
  const importsByFile = new Map(
    records.map((record) => [
      record.sourceFile,
      collectImportBindings(ts, record.sourceFile),
    ]),
  );

  const context = {
    ts,
    checker,
    records,
    importsByFile,
  };

  verifyImports(context);
  verifyNoConsumerRenderLoop(context);
  const jsx = collectJsx(context);
  verifyRuntimeOwnership(context, jsx);
  verifyInputOwnership(context, jsx);
  verifyRuntimeEffects(context, jsx);
  const targets = verifyTargetDeclarations(context, jsx);
  verifySelectedCapabilities(
    context,
    jsx,
    targets,
    selectedCapabilities,
  );
}

function verifyNoConsumerRenderLoop(context) {
  const { ts, records } = context;
  for (const { file, sourceFile } of records) {
    if (/(?:^|\/)(?:test|tests|e2e|scripts)\//.test(relative(consumerRoot, file))) {
      continue;
    }
    visit(ts, sourceFile, (node) => {
      if (!ts.isCallExpression(node)) return;
      const name = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : undefined;
      if (name === "requestAnimationFrame" || name === "setAnimationLoop") {
        add(`${display(file)}: consumer render loops are prohibited`);
      }
    });
  }
}

function verifyImports(context) {
  const { ts, records } = context;
  for (const { file, sourceFile } of records) {
    visit(ts, sourceFile, (node) => {
      if (
        ts.isImportDeclaration(node) ||
        ts.isExportDeclaration(node)
      ) {
        if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
          verifyImportSpecifier(node.moduleSpecifier.text, file);
        }
        return;
      }
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteralLike(node.moduleReference.expression)
      ) {
        verifyImportSpecifier(node.moduleReference.expression.text, file);
        return;
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        verifyImportSpecifier(node.arguments[0].text, file);
        return;
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        verifyImportSpecifier(node.arguments[0].text, file);
      }
    });
  }
}

function verifyImportSpecifier(specifier, file) {
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
  if (specifier === "@react-three/fiber") {
    add(`${display(file)}: React Three Fiber is prohibited`);
  }
}

function collectJsx(context) {
  const { ts, records } = context;
  const jsx = [];
  for (const record of records) {
    visit(ts, record.sourceFile, (node) => {
      if (ts.isJsxElement(node)) {
        jsx.push({
          file: record.file,
          sourceFile: record.sourceFile,
          opening: node.openingElement,
          children: node.children,
          selfClosing: false,
        });
      } else if (ts.isJsxSelfClosingElement(node)) {
        jsx.push({
          file: record.file,
          sourceFile: record.sourceFile,
          opening: node,
          children: [],
          selfClosing: true,
        });
      }
    });
  }
  return jsx;
}

function verifyRuntimeOwnership(context, jsx) {
  const { ts, records } = context;
  let runtimeRoots = 0;

  for (const element of jsx) {
    const reference = resolveImportedReference(
      context,
      element.sourceFile,
      element.opening.tagName,
    );
    if (
      (reference.module === "@viselora/dom-webgl/react" &&
        reference.imported === "WebGLRuntime") ||
      (reference.module === "@viselora/scroll-adapters/react" &&
        reference.imported === "WebGLScrollRuntime")
    ) {
      runtimeRoots += 1;
    }
    if (
      reference.module === "@react-three/fiber" ||
      reference.local === "Canvas"
    ) {
      add(`${display(element.file)}: R3F Canvas roots are prohibited`);
    }
  }

  for (const { file, sourceFile } of records) {
    visit(ts, sourceFile, (node) => {
      if (ts.isCallExpression(node)) {
        const reference = resolveImportedReference(
          context,
          sourceFile,
          node.expression,
        );
        if (
          reference.module === "@viselora/dom-webgl" &&
          reference.imported === "createWebGLRuntime"
        ) {
          runtimeRoots += 1;
        }
      }
      if (ts.isNewExpression(node)) {
        const reference = resolveImportedReference(
          context,
          sourceFile,
          node.expression,
        );
        if (
          (reference.module === "three" &&
            reference.imported === "WebGLRenderer") ||
          reference.local === "WebGLRenderer"
        ) {
          add(`${display(file)}: direct WebGLRenderer construction is prohibited`);
        }
      }
    });
  }

  if (runtimeRoots !== 1) {
    add("consumer must contain exactly one runtime root");
  }
}

function verifyInputOwnership(context, jsx) {
  const { ts, records } = context;
  const inputEvents = new Set([
    "scroll",
    "wheel",
    "touchmove",
    "pointermove",
    "pointerdown",
    "pointerup",
    "pointercancel",
  ]);
  const assignedHandlers = new Set(
    [...inputEvents].map((event) => `on${event}`),
  );
  let unmanagedInput = false;

  for (const { sourceFile } of records) {
    visit(ts, sourceFile, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "addEventListener" &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        inputEvents.has(node.arguments[0].text.toLowerCase())
      ) {
        unmanagedInput = true;
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) &&
        ts.isIdentifier(node.left.expression) &&
        (node.left.expression.text === "window" ||
          node.left.expression.text === "document") &&
        assignedHandlers.has(node.left.name.text.toLowerCase())
      ) {
        unmanagedInput = true;
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isElementAccessExpression(node.left) &&
        ts.isIdentifier(node.left.expression) &&
        (node.left.expression.text === "window" ||
          node.left.expression.text === "document") &&
        node.left.argumentExpression &&
        ts.isStringLiteralLike(node.left.argumentExpression) &&
        assignedHandlers.has(node.left.argumentExpression.text.toLowerCase())
      ) {
        unmanagedInput = true;
      }
    });
  }

  for (const element of jsx) {
    for (const attribute of element.opening.attributes.properties) {
      if (
        ts.isJsxAttribute(attribute) &&
        assignedHandlers.has(attribute.name.text.toLowerCase())
      ) {
        unmanagedInput = true;
      }
    }
  }

  if (unmanagedInput) {
    add("scroll and pointer input must use one managed ownership path");
  }

  const timelines = jsx.filter((element) =>
    isImportedComponent(
      context,
      element,
      "@viselora/scroll-adapters/react",
      "WebGLScrollTimeline",
    ),
  );
  const runtimeHasSmooth = jsx.some(
    (element) =>
      isImportedComponent(
        context,
        element,
        "@viselora/scroll-adapters/react",
        "WebGLScrollRuntime",
      ) && hasJsxAttribute(context.ts, element.opening, "smooth"),
  );
  if (
    timelines.length > 0 &&
    !runtimeHasSmooth &&
    timelines.some(
      (timeline) =>
        !hasJsxAttribute(context.ts, timeline.opening, "ScrollTrigger"),
    )
  ) {
    add("managed scroll timelines require one ScrollTrigger ownership path");
  }
}

function verifyRuntimeEffects(context, jsx) {
  const roots = jsx.filter(
    (element) =>
      isImportedComponent(
        context,
        element,
        "@viselora/dom-webgl/react",
        "WebGLRuntime",
      ) ||
      isImportedComponent(
        context,
        element,
        "@viselora/scroll-adapters/react",
        "WebGLScrollRuntime",
      ),
  );

  for (const root of roots) {
    const effects = readJsxExpression(
      context.ts,
      root.opening,
      "effects",
    );
    if (!effects) {
      add("runtime effects must use one stable module-scope array");
      continue;
    }
    if (!isStableModuleArray(context, effects)) {
      const declaration = resolveValueDeclaration(context, effects);
      if (
        declaration &&
        context.ts.isVariableDeclaration(declaration) &&
        !isModuleScopeDeclaration(context.ts, declaration)
      ) {
        add(
          `${display(root.file)}: runtimeEffects must be declared at module scope`,
        );
      } else {
        add("runtime effects must use one stable module-scope array");
      }
    }
  }
}

function verifyTargetDeclarations(context, jsx) {
  const targets = [];
  for (const element of jsx) {
    if (
      !isImportedComponent(
        context,
        element,
        "@viselora/dom-webgl/react",
        "WebGLTarget",
      )
    ) {
      continue;
    }

    const webgl = readJsxExpression(context.ts, element.opening, "webgl");
    if (!webgl || !isStableTargetExpression(context, webgl)) {
      add(`${display(element.file)}: target declarations must be stable`);
    }

    const declarations = webgl ? resolveObjectLiterals(context, webgl) : [];
    for (const declaration of declarations) {
      targets.push(createTargetInfo(context, element, declaration));
    }
  }
  return targets;
}

function verifySelectedCapabilities(
  context,
  jsx,
  targets,
  selectedCapabilities,
) {
  const definitions = collectEffectDefinitions(context);
  const timelines = collectTimelineProgressExpressions(context, jsx);
  const sourceText = context.records
    .map(({ sourceFile }) => sourceFile.getFullText())
    .join("\n");
  const selectedIds = new Set(selectedCapabilities.map((capability) => capability.id));
  if (
    sourceText.includes("defineWebGLSceneObjectEffect") &&
    !selectedIds.has("scene-object-effect-registration")
  ) {
    add("defineWebGLSceneObjectEffect requires scene-object-effect-registration capability");
  }
  if (
    selectedIds.has("advanced-effect-facades") &&
    /ctx\.object\.model|model\.sampling|model\.points/.test(sourceText) &&
    !selectedIds.has("scene-object-effect-registration")
  ) {
    add("advanced-effect-facades scene/model path requires scene-object-effect-registration capability");
  }

  for (const capability of selectedCapabilities) {
    switch (capability.id) {
      case "managed-image-hover":
        verifyManagedImageHover(
          context,
          targets,
          definitions,
          sourceText,
        );
        break;
      case "managed-video":
        verifyManagedVideo(context, targets, definitions);
        break;
      case "shared-scroll-progress":
        verifySharedScrollProgress(context, targets, definitions, timelines);
        break;
      case "image-sequence":
        verifyImageSequence(context, targets, definitions, timelines);
        break;
      case "glb-loading-lifecycle":
      case "dom-anchored-glb-visible-output":
        if (
          !targets.some(
            (target) =>
              target.sourceKind === "model" && target.sourceType === "glb",
          )
        ) {
          add(`[${capability.id}] missing managed model/glb declaration`);
        }
        break;
      case "scene-native-models":
        if (collectModelComponentInfo(context, jsx).length === 0) {
          add(`[${capability.id}] missing public WebGLModel declaration`);
        }
        break;
      case "scene-object-effect-registration":
        if (
          !sourceText.includes("defineWebGLSceneObjectEffect") ||
          (!sourceText.includes("WebGLModel") && !sourceText.includes("WebGLStage"))
        ) {
          add(`[${capability.id}] missing root-defined effect and React scene-object consumer`);
        }
        break;
      case "scene-camera-pass":
        if (!sourceText.includes("WebGLScene") || !sourceText.includes("WebGLCamera")) {
          add(`[${capability.id}] missing managed scene/camera declarations`);
        }
        break;
      case "scene-object-interaction":
        if (!sourceText.includes("interaction") || !sourceText.includes("pickable")) {
          add(`[${capability.id}] missing managed picking declaration`);
        }
        break;
      case "camera-gestures":
        if (!sourceText.includes("controller") || !sourceText.includes("pointer")) {
          add(`[${capability.id}] missing managed camera controller`);
        }
        break;
      case "physics":
        if (!sourceText.includes("physics")) {
          add(`[${capability.id}] missing managed physics descriptors`);
        }
        break;
      case "advanced-effect-facades":
        if (!sourceText.includes("ctx.resources")) {
          add(`[${capability.id}] missing effect resource disposal evidence`);
        }
        break;
      case "surface-pulse-visible-output":
        if (!sourceText.includes("ctx.object.surface")) {
          add(`[${capability.id}] missing retained surface reproduction`);
        }
        break;
      case "resource-fallback-lifecycle":
        if (
          targets.length === 0 ||
          targets.some(
            (target) => !target.explicitLifecycle || !target.fallbackEvidence,
          )
        ) {
          add(`[${capability.id}] missing explicit lifecycle/offscreen/fallback evidence`);
        }
        break;
      case "public-imports-ssr":
      case "single-runtime-canvas":
      case "runtime-remount":
      case "reduced-motion-signaling":
        break;
    }
  }
}

function verifyManagedImageHover(context, targets, definitions, sourceText) {
  const hover = targets.find(
    (target) =>
      target.sourceKind === "media" &&
      target.sourceType === "image" &&
      target.pointerHover &&
      findUsedDefinition(target, definitions, (definition) =>
        definitionHasCall(context, definition, "createMaterialLayer"),
      ),
  );
  if (!hover) {
    add("[managed-image-hover] missing managed media/image pointer-hover target");
    return;
  }
  const definition = findUsedDefinition(
    hover,
    definitions,
    (candidate) => definitionHasCall(context, candidate, "createMaterialLayer"),
  );
  if (
    !definition ||
    !definitionHasContextCapabilities(context, definition, [
      ["targetPointer"],
      ["resources", "addDisposable"],
    ])
  ) {
    add("[managed-image-hover] requires managed target pointer and disposable layer ownership");
  }
  for (const evidence of [
    'mode: "replace-source"',
    "sourceTextureUniform",
    "uSourceTexture",
    "texture2D(uSourceTexture",
  ]) {
    if (!sourceText.includes(evidence)) {
      add(`[managed-image-hover] missing source sampling evidence: ${evidence}`);
    }
  }
  if (!hover.explicitLifecycle || !hover.fallbackEvidence) {
    add("[managed-image-hover] missing loading/error fallback lifecycle");
  }
}

function verifyManagedVideo(context, targets, definitions) {
  const video = targets.find(
    (target) =>
      target.sourceKind === "media" &&
      target.sourceType === "video" &&
      findUsedDefinition(target, definitions, (definition) =>
        definitionHasContextCapabilities(context, definition, [
          ["object", "video"],
        ]),
      ),
  );
  if (!video || !video.explicitLifecycle || !video.fallbackEvidence) {
    add("[managed-video] missing managed video declaration and fallback lifecycle");
  }
}

function verifySharedScrollProgress(context, targets, definitions, timelines) {
  const matched = targets.some((target) => {
    const effectProgress = target.effectObjects
      .map((effect) => readObjectPropertyExpression(context.ts, effect, "progressKey"))
      .find(Boolean);
    if (!effectProgress) return false;
    const definition = findUsedDefinition(target, definitions, (candidate) =>
      definitionHasProperty(context, candidate, "progress"),
    );
    return Boolean(
      definition &&
        timelines.some((timeline) =>
          expressionsMatch(context, effectProgress, timeline),
        ),
    );
  });
  if (!matched) {
    add("[shared-scroll-progress] missing matching timeline/effect progress path");
  }
}

function verifyImageSequence(context, targets, definitions, timelines) {
  const candidates = targets.filter(
    (target) =>
      target.sourceKind === "media" &&
      target.sourceType === "image-sequence",
  );
  const sequence = candidates.find((target) => {
    if (!target.progressExpression) return false;
    const definition = findUsedDefinition(
      target,
      definitions,
      (candidate) => candidate.source === "media/image-sequence",
    );
    return Boolean(
      definition &&
        timelines.some((timeline) =>
          expressionsMatch(context, target.progressExpression, timeline),
        ),
    );
  });
  if (!sequence) {
    if (candidates.length === 0) {
      add("[image-sequence] missing stable media/image-sequence target");
      return;
    }
    const target = candidates[0];
    if (!target.progressExpression) {
      add("[image-sequence] source requires a stable progressKey");
    }
    if (
      !findUsedDefinition(
        target,
        definitions,
        (candidate) => candidate.source === "media/image-sequence",
      )
    ) {
      add("[image-sequence] missing matching media/image-sequence effect definition");
    }
    if (
      target.progressExpression &&
      !timelines.some((timeline) =>
        expressionsMatch(context, target.progressExpression, timeline),
      )
    ) {
      add("[image-sequence] progressKey does not match a managed timeline");
    }
  } else if (!sequence.explicitLifecycle || !sequence.fallbackEvidence) {
    add("[image-sequence] missing first-frame fallback or lifecycle evidence");
  }
}

function collectEffectDefinitions(context) {
  const { ts, records } = context;
  const definitions = new Map();
  for (const { sourceFile } of records) {
    visit(ts, sourceFile, (node) => {
      if (!ts.isCallExpression(node) || node.arguments.length === 0) {
        return;
      }
      const reference = resolveImportedReference(
        context,
        sourceFile,
        node.expression,
      );
      if (
        reference.module !== "@viselora/dom-webgl" ||
        reference.imported !== "defineWebGLEffect"
      ) {
        return;
      }
      for (const object of resolveObjectLiterals(context, node.arguments[0])) {
        const kind = readObjectString(context, object, "kind");
        if (!kind) return;
        definitions.set(kind, {
          kind,
          source: readObjectString(context, object, "source"),
          update: readObjectFunction(context.ts, object, "update"),
        });
      }
    });
  }
  return definitions;
}

function createTargetInfo(context, element, declaration) {
  const { ts } = context;
  const sourceExpression = readObjectPropertyExpression(ts, declaration, "source");
  const source = resolveObjectLiterals(context, sourceExpression)[0];
  const effectsExpression = readObjectPropertyExpression(ts, declaration, "effects");
  const effectObjects = resolveArrayObjectLiterals(context, effectsExpression);
  const pointerExpression = readObjectPropertyExpression(ts, declaration, "pointer");
  const pointer = resolveObjectLiterals(context, pointerExpression)[0];
  const lifecycleExpression = readObjectPropertyExpression(
    ts,
    declaration,
    "lifecycle",
  );
  const lifecycle = resolveObjectLiterals(context, lifecycleExpression)[0];
  const offscreen = lifecycle
    ? resolveObjectLiterals(
        context,
        readObjectPropertyExpression(ts, lifecycle, "offscreen"),
      )[0]
    : undefined;
  const sourceType = source ? readObjectString(context, source, "type") : undefined;

  return {
    element,
    sourceKind: source ? readObjectString(context, source, "kind") : undefined,
    sourceType,
    effectKinds: effectObjects
      .map((effect) => readObjectString(context, effect, "kind"))
      .filter(Boolean),
    effectObjects,
    pointerHover: pointer
      ? readObjectBoolean(context, pointer, "hover") === true
      : false,
    timelineExpression: readObjectPropertyExpression(ts, declaration, "timeline"),
    progressExpression: source
      ? readObjectPropertyExpression(ts, source, "progressKey")
      : undefined,
    explicitLifecycle: Boolean(
      lifecycle &&
        offscreen &&
        readObjectPropertyExpression(ts, lifecycle, "hideWhenReady") &&
        readObjectPropertyExpression(ts, lifecycle, "hideMode") &&
        readObjectPropertyExpression(ts, offscreen, "strategy"),
    ),
    fallbackEvidence: hasFallbackEvidence(context, element, sourceType),
  };
}

function collectModelComponentInfo(context, jsx) {
  return jsx
    .filter((element) =>
      isImportedComponent(
        context,
        element,
        "@viselora/dom-webgl/react",
        "WebGLModel",
      ),
    )
    .map((element) => {
      const effects = readJsxExpression(context.ts, element.opening, "effects");
      const effectObjects = resolveArrayObjectLiterals(context, effects);
      return {
        element,
        sourceKind: "model",
        sourceType: "glb",
        effectKinds: effectObjects
          .map((effect) => readObjectString(context, effect, "kind"))
          .filter(Boolean),
        effectObjects,
        timelineExpression: readJsxExpression(
          context.ts,
          element.opening,
          "timeline",
        ),
      };
    });
}

function isModelDefinition(context, definition) {
  return (
    definition.source === "model/glb" &&
    definitionHasContextCapabilities(context, definition, [
      ["object", "animation"],
      ["object", "lights"],
    ]) &&
    definitionHasProperty(context, definition, "emissive") &&
    definitionHasCall(context, definition, "point")
  );
}

function findUsedDefinition(target, definitions, predicate) {
  for (const kind of target.effectKinds) {
    const definition = definitions.get(kind);
    if (definition && predicate(definition)) {
      return definition;
    }
  }
  return undefined;
}

function definitionHasContextCapabilities(context, definition, paths) {
  if (!definition.update || definition.update.parameters.length === 0) {
    return false;
  }
  const parameter = definition.update.parameters[0].name;
  if (!context.ts.isIdentifier(parameter) || !definition.update.body) {
    return false;
  }
  return paths.every((path) =>
    hasNode(context.ts, definition.update.body, (node) => {
      const access = readAccessPath(context.ts, node);
      return (
        access &&
        access[0] === parameter.text &&
        path.every((segment, index) => access[index + 1] === segment)
      );
    }),
  );
}

function definitionHasCall(context, definition, name) {
  return Boolean(
    definition.update?.body &&
      hasNode(context.ts, definition.update.body, (node) =>
        context.ts.isCallExpression(node) &&
        context.ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === name,
      ),
  );
}

function definitionHasProperty(context, definition, name) {
  return Boolean(
    definition.update?.body &&
      hasNode(
        context.ts,
        definition.update.body,
        (node) =>
          context.ts.isPropertyAccessExpression(node) &&
          node.name.text === name,
      ),
  );
}

function collectTimelineProgressExpressions(context, jsx) {
  const values = [];
  for (const element of jsx) {
    if (
      !isImportedComponent(
        context,
        element,
        "@viselora/scroll-adapters/react",
        "WebGLScrollTimeline",
      )
    ) {
      continue;
    }
    const progress =
      readJsxExpression(context.ts, element.opening, "progressKey") ??
      readJsxExpression(context.ts, element.opening, "id");
    if (progress) values.push(progress);
  }
  return values;
}

function isRequiredTargetSurface(target) {
  return (
    (target.sourceKind === "dom" && target.sourceType === "element") ||
    (target.sourceKind === "media" &&
      (target.sourceType === "video" ||
        target.sourceType === "image-sequence" ||
        (target.sourceType === "image" && target.pointerHover))) ||
    (target.sourceKind === "model" && target.sourceType === "glb")
  );
}

function hasFallbackEvidence(context, element, sourceType) {
  const { ts } = context;
  const as = readJsxLiteral(ts, element.opening, "as");
  if (element.selfClosing) {
    if (sourceType === "video" && as === "video") {
      return hasJsxAttribute(ts, element.opening, "src");
    }
    if (sourceType === "image" && as === "img") {
      return (
        hasJsxAttribute(ts, element.opening, "src") &&
        hasJsxAttribute(ts, element.opening, "alt")
      );
    }
    return false;
  }
  return element.children.some((child) => {
    if (ts.isJsxText(child)) return child.text.trim().length > 0;
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) return true;
    return ts.isJsxExpression(child) && child.expression !== undefined;
  });
}

function isStableModuleArray(context, expression) {
  if (!context.ts.isIdentifier(unwrap(context.ts, expression))) {
    return false;
  }
  const declaration = resolveValueDeclaration(context, expression);
  return Boolean(
    declaration &&
      context.ts.isVariableDeclaration(declaration) &&
      isConstDeclaration(context.ts, declaration) &&
      isModuleScopeDeclaration(context.ts, declaration) &&
      declaration.initializer &&
      resolveExpressions(context, declaration.initializer).some((candidate) =>
        context.ts.isArrayLiteralExpression(candidate),
      ),
  );
}

function isStableTargetExpression(context, expression) {
  const unwrapped = unwrap(context.ts, expression);
  const root = readAccessRoot(context.ts, unwrapped);
  if (!root) return false;
  const declaration = resolveValueDeclaration(context, root);
  if (
    !declaration ||
    !context.ts.isVariableDeclaration(declaration) ||
    !isConstDeclaration(context.ts, declaration) ||
    !declaration.initializer
  ) {
    return false;
  }
  if (context.ts.isIdentifier(unwrapped)) {
    return (
      isModuleScopeDeclaration(context.ts, declaration) ||
      isUseMemoCall(context, declaration.initializer)
    );
  }
  return Boolean(
    isModuleScopeDeclaration(context.ts, declaration) &&
      resolveObjectLiterals(context, unwrapped).length > 0,
  );
}

function isUseMemoCall(context, expression) {
  const candidate = unwrap(context.ts, expression);
  if (!context.ts.isCallExpression(candidate)) return false;
  const reference = resolveImportedReference(
    context,
    candidate.getSourceFile(),
    candidate.expression,
  );
  return (
    reference.module === "react" && reference.imported === "useMemo"
  );
}

function resolveObjectLiterals(context, expression) {
  if (!expression) return [];
  return resolveExpressions(context, expression).filter((candidate) =>
    context.ts.isObjectLiteralExpression(candidate),
  );
}

function resolveArrayObjectLiterals(context, expression) {
  if (!expression) return [];
  const objects = [];
  for (const candidate of resolveExpressions(context, expression)) {
    if (!context.ts.isArrayLiteralExpression(candidate)) continue;
    for (const element of candidate.elements) {
      objects.push(...resolveObjectLiterals(context, element));
    }
  }
  return objects;
}

function resolveExpressions(context, expression, seen = new Set()) {
  if (!expression) return [];
  const candidate = unwrap(context.ts, expression);
  if (seen.has(candidate)) return [];
  seen.add(candidate);

  if (context.ts.isIdentifier(candidate)) {
    const declaration = resolveValueDeclaration(context, candidate);
    if (
      declaration &&
      context.ts.isVariableDeclaration(declaration) &&
      declaration.initializer
    ) {
      return resolveExpressions(context, declaration.initializer, seen);
    }
  }

  if (context.ts.isPropertyAccessExpression(candidate)) {
    const values = [];
    for (const object of resolveObjectLiterals(context, candidate.expression)) {
      const property = readObjectPropertyExpression(
        context.ts,
        object,
        candidate.name.text,
      );
      values.push(...resolveExpressions(context, property, seen));
    }
    if (values.length > 0) return values;
  }

  if (context.ts.isConditionalExpression(candidate)) {
    return [
      ...resolveExpressions(context, candidate.whenTrue, seen),
      ...resolveExpressions(context, candidate.whenFalse, seen),
    ];
  }

  if (isUseMemoCall(context, candidate) && candidate.arguments[0]) {
    return collectReturnedExpressions(context, candidate.arguments[0], seen);
  }

  return [candidate];
}

function collectReturnedExpressions(context, callbackExpression, seen) {
  const callback = unwrap(context.ts, callbackExpression);
  if (
    !context.ts.isArrowFunction(callback) &&
    !context.ts.isFunctionExpression(callback)
  ) {
    return [];
  }
  if (!context.ts.isBlock(callback.body)) {
    return resolveExpressions(context, callback.body, seen);
  }
  const values = [];
  visit(context.ts, callback.body, (node) => {
    if (context.ts.isReturnStatement(node) && node.expression) {
      values.push(...resolveExpressions(context, node.expression, seen));
    }
  });
  return values;
}

function expressionsMatch(context, left, right) {
  const leftKeys = new Set(resolveExpressions(context, left).map(expressionKey));
  return resolveExpressions(context, right).some((candidate) =>
    leftKeys.has(expressionKey(candidate)),
  );
}

function expressionKey(expression) {
  if (!expression) return "missing";
  if (expression.text !== undefined && typeof expression.text === "string") {
    return `${expression.kind}:${expression.text}`;
  }
  return `${expression.kind}:${expression.getSourceFile().fileName}:${expression.pos}:${expression.end}`;
}

function readObjectString(context, object, name) {
  const expression = readObjectPropertyExpression(context.ts, object, name);
  for (const candidate of resolveExpressions(context, expression)) {
    if (context.ts.isStringLiteralLike(candidate)) return candidate.text;
  }
  return undefined;
}

function readObjectBoolean(context, object, name) {
  const expression = readObjectPropertyExpression(context.ts, object, name);
  for (const candidate of resolveExpressions(context, expression)) {
    if (candidate.kind === context.ts.SyntaxKind.TrueKeyword) return true;
    if (candidate.kind === context.ts.SyntaxKind.FalseKeyword) return false;
  }
  return undefined;
}

function readObjectFunction(ts, object, name) {
  for (const property of object.properties) {
    if (readPropertyName(ts, property.name) !== name) continue;
    if (ts.isMethodDeclaration(property)) return property;
    if (
      ts.isPropertyAssignment(property) &&
      (ts.isArrowFunction(property.initializer) ||
        ts.isFunctionExpression(property.initializer))
    ) {
      return property.initializer;
    }
  }
  return undefined;
}

function readObjectPropertyExpression(ts, object, name) {
  if (!object) return undefined;
  for (const property of object.properties) {
    if (readPropertyName(ts, property.name) !== name) continue;
    if (ts.isPropertyAssignment(property)) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property)) return property.name;
  }
  return undefined;
}

function readPropertyName(ts, name) {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return undefined;
}

function readJsxExpression(ts, opening, name) {
  const attribute = opening.attributes.properties.find(
    (property) =>
      ts.isJsxAttribute(property) && property.name.text === name,
  );
  if (!attribute || !ts.isJsxAttribute(attribute)) return undefined;
  if (
    attribute.initializer &&
    ts.isJsxExpression(attribute.initializer)
  ) {
    return attribute.initializer.expression;
  }
  if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer;
  }
  return undefined;
}

function readJsxLiteral(ts, opening, name) {
  const expression = readJsxExpression(ts, opening, name);
  return expression && ts.isStringLiteralLike(expression)
    ? expression.text
    : undefined;
}

function hasJsxAttribute(ts, opening, name) {
  return opening.attributes.properties.some(
    (property) =>
      ts.isJsxAttribute(property) && property.name.text === name,
  );
}

function isImportedComponent(context, element, module, imported) {
  const reference = resolveImportedReference(
    context,
    element.sourceFile,
    element.opening.tagName,
  );
  return reference.module === module && reference.imported === imported;
}

function resolveImportedReference(context, sourceFile, expression) {
  const { ts } = context;
  const bindings = context.importsByFile.get(sourceFile) ?? new Map();
  if (ts.isIdentifier(expression)) {
    const binding = bindings.get(expression.text);
    return binding
      ? { ...binding, local: expression.text }
      : { local: expression.text };
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const root = readAccessPath(ts, expression)?.[0];
    const binding = root ? bindings.get(root) : undefined;
    if (binding?.imported === "*") {
      return {
        module: binding.module,
        imported: expression.name.text,
        local: expression.name.text,
      };
    }
    return { local: expression.name.text };
  }
  return {};
}

function collectImportBindings(ts, sourceFile) {
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      !statement.importClause
    ) {
      continue;
    }
    const module = statement.moduleSpecifier.text;
    if (statement.importClause.name) {
      bindings.set(statement.importClause.name.text, {
        module,
        imported: "default",
      });
    }
    const named = statement.importClause.namedBindings;
    if (named && ts.isNamespaceImport(named)) {
      bindings.set(named.name.text, { module, imported: "*" });
    } else if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) {
        bindings.set(element.name.text, {
          module,
          imported: element.propertyName?.text ?? element.name.text,
        });
      }
    }
  }
  return bindings;
}

function resolveValueDeclaration(context, expression) {
  const candidate = unwrap(context.ts, expression);
  if (!context.ts.isIdentifier(candidate)) return undefined;
  let symbol = context.checker.getSymbolAtLocation(candidate);
  if (!symbol) return undefined;
  if (symbol.flags & context.ts.SymbolFlags.Alias) {
    try {
      symbol = context.checker.getAliasedSymbol(symbol);
    } catch {
      return undefined;
    }
  }
  return symbol.valueDeclaration ?? symbol.declarations?.[0];
}

function isConstDeclaration(ts, declaration) {
  return Boolean(
    declaration.parent.flags & ts.NodeFlags.Const,
  );
}

function isModuleScopeDeclaration(ts, declaration) {
  return Boolean(
    declaration.parent?.parent?.parent &&
      ts.isSourceFile(declaration.parent.parent.parent),
  );
}

function unwrap(ts, expression) {
  let candidate = expression;
  while (
    ts.isParenthesizedExpression(candidate) ||
    ts.isAsExpression(candidate) ||
    ts.isSatisfiesExpression(candidate) ||
    ts.isNonNullExpression(candidate)
  ) {
    candidate = candidate.expression;
  }
  return candidate;
}

function readAccessPath(ts, node) {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) {
    const prefix = readAccessPath(ts, node.expression);
    return prefix ? [...prefix, node.name.text] : undefined;
  }
  return undefined;
}

function readAccessRoot(ts, node) {
  let candidate = node;
  while (
    ts.isPropertyAccessExpression(candidate) ||
    ts.isElementAccessExpression(candidate)
  ) {
    candidate = candidate.expression;
  }
  return ts.isIdentifier(candidate) ? candidate : undefined;
}

function hasNode(ts, root, predicate) {
  let found = false;
  visit(ts, root, (node) => {
    if (!found && predicate(node)) found = true;
  });
  return found;
}

function visit(ts, root, visitor) {
  const walk = (node) => {
    visitor(node);
    ts.forEachChild(node, walk);
  };
  walk(root);
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

function display(file) {
  return relative(consumerRoot, file) || file;
}

function add(message) {
  if (!violations.includes(message)) violations.push(message);
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}
