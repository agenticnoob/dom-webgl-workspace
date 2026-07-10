import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const skillRoot = resolve(repoRoot, "skills/viselora-dom-webgl");
const verifierPath = resolve(skillRoot, "scripts/verify-consumer.mjs");
const templateRoot = resolve(skillRoot, "templates/react-vite");
const fixtureRoots: string[] = [];

const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/architecture-rules.md",
  "references/effect-recipes.md",
  "references/public-api.md",
  "references/quickstart.md",
  "references/troubleshooting.md",
  "references/verification.md",
  "scripts/verify-consumer.mjs",
  "templates/effects/image-hover-overlay.ts",
  "templates/effects/pinned-model-glow.tsx",
  "templates/effects/scroll-image-sequence.tsx",
  "templates/effects/surface-pulse.ts",
  "templates/effects/video-background-texture.ts",
  "templates/react-vite/package.json",
  "templates/react-vite/src/App.tsx",
  "templates/react-vite/src/effects.ts",
] as const;

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

describe("viselora-dom-webgl skill", () => {
  test("contains exactly the public skill deliverables", () => {
    expect(collectFiles(skillRoot)).toEqual(requiredFiles);
  });

  test("uses minimal skill frontmatter and matching agent metadata", () => {
    const skill = read("SKILL.md");
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1];

    expect(frontmatter).toBeDefined();
    expect(frontmatter?.split("\n").map((line) => line.split(":", 1)[0])).toEqual([
      "name",
      "description",
    ]);
    expect(frontmatter).toContain("name: viselora-dom-webgl");
    expect(frontmatter).not.toContain("TODO");

    expect(read("agents/openai.yaml")).toBe(
      [
        "interface:",
        '  display_name: "Viselora DOM WebGL"',
        '  short_description: "Build verified DOM-first WebGL pages with Viselora"',
        '  default_prompt: "Use $viselora-dom-webgl to build a DOM-first WebGL page with one runtime and verified public package imports."',
        "",
      ].join("\n"),
    );
  });

  test("documents the exact alpha and all five complete recipes", () => {
    const allContent = requiredFiles
      .filter((file) => /\.(?:md|tsx?)$/.test(file))
      .map((file) => read(file))
      .join("\n");
    const recipes = read("references/effect-recipes.md");

    expect(allContent).toContain("Compatible package version: 0.1.0-alpha.0");
    expect(recipes).toContain("## Surface pulse");
    expect(recipes).toContain("## Video background texture");
    expect(recipes).toContain("## Image hover overlay");
    expect(recipes).toContain("## Pinned model glow");
    expect(recipes).toContain("## Scroll image sequence");

    expect(read("templates/effects/surface-pulse.ts")).toContain(
      'kind: "viselora.surfacePulse"',
    );
    expect(read("templates/effects/video-background-texture.ts")).toContain(
      'kind: "viselora.videoBackground"',
    );
    expect(read("templates/effects/image-hover-overlay.ts")).toContain(
      'kind: "viselora.imageHoverOverlay"',
    );
    expect(read("templates/effects/pinned-model-glow.tsx")).toContain(
      'kind: "viselora.modelGlow"',
    );
    expect(read("templates/effects/scroll-image-sequence.tsx")).toContain(
      'const progressKey = "sequence-progress"',
    );
  });

  test("keeps standalone recipes stable, scroll-driven, and resource-owned", () => {
    const pinnedModel = read("templates/effects/pinned-model-glow.tsx");
    const imageSequence = read("templates/effects/scroll-image-sequence.tsx");
    const hoverOverlay = read("templates/effects/image-hover-overlay.ts");
    const recipes = read("references/effect-recipes.md");
    const publicApi = read("references/public-api.md");

    expect(pinnedModel.indexOf("const pinnedModelDeclaration")).toBeLessThan(
      pinnedModel.indexOf("export function PinnedModelGlow"),
    );
    expect(pinnedModel).toContain('from "gsap/ScrollTrigger"');
    expect(pinnedModel).toContain("ScrollTrigger={ScrollTrigger}");
    expect(pinnedModel).toContain("ctx.resources.addDisposable");
    expect(imageSequence).toContain("useMemo");
    expect(imageSequence).toContain('from "gsap/ScrollTrigger"');
    expect(imageSequence).toContain("ScrollTrigger={ScrollTrigger}");
    expect(hoverOverlay).toContain("ctx.resources.addDisposable");
    expect(recipes).toContain("const pinnedModelDeclaration");
    expect(recipes).toContain("useMemo");
    expect(recipes).toContain("ScrollTrigger={ScrollTrigger}");
    expect(recipes).toContain("ctx.resources.addDisposable");
    expect(publicApi.indexOf("const productPhotoDeclaration")).toBeLessThan(
      publicApi.indexOf("<WebGLTarget"),
    );
  });

  test("uses only public package entrypoints and excludes R3F", () => {
    const content = collectFiles(skillRoot)
      .map((file) => read(file))
      .join("\n");

    expect(content).not.toMatch(/from\s+["']@project\//);
    expect(content).not.toMatch(
      /(?:from\s+|import\s+)["'][^"']*packages\/dom-webgl-runtime\/src/,
    );
    expect(content).not.toMatch(/from\s+["']@react-three\/fiber["']/);
  });

  test("accepts the supplied React Vite consumer", () => {
    const result = runVerifier(templateRoot);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Viselora consumer verification passed");
  });

  test("accepts an identifier-independent progress key", () => {
    const fixtureRoot = copyTemplate();
    replaceAll(fixtureRoot, "src/App.tsx", "sharedProgressKey", "productProgressKey");

    const result = runVerifier(fixtureRoot);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("accepts a stable declaration selected through module-scope property access", () => {
    const fixtureRoot = copyTemplate();
    replace(
      fixtureRoot,
      "src/App.tsx",
      "webgl={surfaceDeclaration}",
      "webgl={declarations.surface}",
    );
    append(
      fixtureRoot,
      "src/App.tsx",
      "\nconst declarations = { surface: surfaceDeclaration } as const;\n",
    );

    const result = runVerifier(fixtureRoot);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("accepts the public WebGLModel route for the model recipe", () => {
    const fixtureRoot = copyTemplate();
    replace(
      fixtureRoot,
      "src/App.tsx",
      'import { WebGLTarget } from "@viselora/dom-webgl/react";',
      'import { WebGLModel, WebGLTarget } from "@viselora/dom-webgl/react";',
    );
    replace(
      fixtureRoot,
      "src/App.tsx",
      [
        '          <WebGLTarget as="section" webgl={modelDeclaration}>',
        "            <p>Interactive product model loading…</p>",
        "          </WebGLTarget>",
      ].join("\n"),
      [
        "          <section>",
        "            <p>Interactive product model loading…</p>",
        "            <WebGLModel",
        '              id="demo.pinned-model"',
        '              scene="demo.product-scene"',
        '              src="/models/product.glb"',
        "              timeline={{ id: productProgressKey, progressKey: productProgressKey }}",
        "              effects={modelDeclaration.effects}",
        "            />",
        "          </section>",
      ].join("\n"),
    );
    replaceAll(fixtureRoot, "src/App.tsx", "sharedProgressKey", "productProgressKey");

    const result = runVerifier(fixtureRoot);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("ignores prohibited-looking text in comments and ordinary strings", () => {
    const fixtureRoot = copyTemplate();
    append(
      fixtureRoot,
      "src/App.tsx",
      [
        "",
        "// <Canvas />; new WebGLRenderer(); import('@project/comment-only')",
        "const architectureNote = `new WebGLRenderer(); <WebGLRuntime />;`;",
        "void architectureNote;",
        "",
      ].join("\n"),
    );

    const result = runVerifier(fixtureRoot);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("reports a clear violation when the consumer has no installed TypeScript", () => {
    const fixtureRoot = copyTemplate({ installTypeScript: false });

    const result = runVerifier(fixtureRoot);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("TypeScript compiler API is unavailable");
  });

  test.each([
    [
      "wrong package version",
      (root: string) =>
        replace(root, "package.json", '"0.1.0-alpha.0"', '"^0.1.0-alpha.0"'),
      "exactly 0.1.0-alpha.0",
    ],
    [
      "project aliases",
      (root: string) => append(root, "src/App.tsx", '\nimport "@project/runtime";\n'),
      "@project/* imports are prohibited",
    ],
    [
      "repository source imports",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nimport "packages/dom-webgl-runtime/src/index";\n',
        ),
      "repository source imports are prohibited",
    ],
    [
      "two runtime roots",
      (root: string) =>
        append(root, "src/App.tsx", "\nconst duplicateRoot = <WebGLScrollRuntime />;\n"),
      "exactly one runtime root",
    ],
    [
      "an aliased second runtime root",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nimport { WebGLScrollRuntime as ScrollRoot } from "@viselora/scroll-adapters/react";\nconst duplicateRoot = <ScrollRoot />;\n',
        ),
      "exactly one runtime root",
    ],
    [
      "an aliased imperative second runtime root",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nimport { createWebGLRuntime as makeRuntime } from "@viselora/dom-webgl";\nmakeRuntime({ container: document.body });\n',
        ),
      "exactly one runtime root",
    ],
    [
      "a direct Three renderer",
      (root: string) => append(root, "src/App.tsx", "\nnew WebGLRenderer();\n"),
      "direct WebGLRenderer construction is prohibited",
    ],
    [
      "an aliased Three renderer",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nimport { WebGLRenderer as Renderer } from "three";\nnew Renderer();\n',
        ),
      "direct WebGLRenderer construction is prohibited",
    ],
    [
      "an R3F import",
      (root: string) =>
        append(root, "src/App.tsx", '\nimport { Canvas } from "@react-three/fiber";\n'),
      "React Three Fiber is prohibited",
    ],
    [
      "an R3F Canvas",
      (root: string) => append(root, "src/App.tsx", "\nconst extraCanvas = <Canvas />;\n"),
      "R3F Canvas roots are prohibited",
    ],
    [
      "an aliased R3F Canvas",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nimport { Canvas as SceneCanvas } from "@react-three/fiber";\nconst extraCanvas = <SceneCanvas />;\n',
        ),
      "React Three Fiber is prohibited",
    ],
    [
      "component-scoped runtime effects",
      (root: string) => {
        replace(root, "src/App.tsx", "export function App() {", "export function App() {\n  const runtimeEffects = [];");
        replace(root, "src/App.tsx", "effects={runtimeEffects}", "effects={runtimeEffects}");
      },
      "runtimeEffects must be declared at module scope",
    ],
    [
      "constructed runtime effects",
      (root: string) =>
        replace(
          root,
          "src/App.tsx",
          "effects={runtimeEffects}",
          "effects={[...runtimeEffects]}",
        ),
      "runtime effects must use one stable module-scope array",
    ],
    [
      "an inline target declaration",
      (root: string) =>
        replace(
          root,
          "src/App.tsx",
          "webgl={surfaceDeclaration}",
          "webgl={{ ...surfaceDeclaration }}",
        ),
      "target declarations must be stable",
    ],
    [
      "a component-owned scroll listener",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nwindow.addEventListener("scroll", () => undefined);\n',
        ),
      "scroll and pointer input must use one managed ownership path",
    ],
    [
      "assigned scroll and pointer listeners",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          "\nwindow.onscroll = () => undefined;\ndocument.onpointermove = () => undefined;\n",
        ),
      "scroll and pointer input must use one managed ownership path",
    ],
    [
      "a dynamic private Viselora import",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nvoid import("@viselora/dom-webgl/private");\n',
        ),
      "non-public Viselora import",
    ],
    [
      "a dynamic project import",
      (root: string) =>
        append(root, "src/App.tsx", '\nvoid import("@project/runtime");\n'),
      "@project/* imports are prohibited",
    ],
    [
      "a dynamic repository source import",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nvoid import("packages/dom-webgl-runtime/src/index");\n',
        ),
      "repository source imports are prohibited",
    ],
    [
      "a CommonJS private Viselora import",
      (root: string) =>
        writeFileSync(
          resolve(root, "src/private.cjs"),
          'require("@viselora/dom-webgl/private");\n',
        ),
      "non-public Viselora import",
    ],
    [
      "a computed assigned input listener",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nwindow["onscroll"] = () => undefined;\n',
        ),
      "scroll and pointer input must use one managed ownership path",
    ],
    [
      "a locally forged useMemo declaration",
      (root: string) =>
        replace(
          root,
          "src/App.tsx",
          'import { useEffect, useMemo, useState } from "react";',
          'import { useEffect, useState } from "react";\nconst useMemo = <T,>(factory: () => T): T => factory();',
        ),
      "target declarations must be stable",
    ],
    [
      "the video surface",
      (root: string) => replace(root, "src/App.tsx", 'type: "video"', 'type: "image"'),
      "missing media/video surface",
    ],
    [
      "a dom/text pulse substitution",
      (root: string) =>
        replace(
          root,
          "src/App.tsx",
          'source: { kind: "dom", type: "element" }',
          'source: { kind: "dom", type: "text" }',
        ),
      "missing dom/element surface pulse surface",
    ],
    [
      "the pointer-hover surface",
      (root: string) => replace(root, "src/App.tsx", 'pointer: { hover: true }', ""),
      "missing pointer-hover surface",
    ],
    [
      "the pinned model glow surface",
      (root: string) => replace(root, "src/App.tsx", 'kind: "viselora.modelGlow"', 'kind: "viselora.surfacePulse"'),
      "missing pinned model glow surface",
    ],
    [
      "the image-sequence surface",
      (root: string) => replace(root, "src/App.tsx", 'type: "image-sequence"', 'type: "image"'),
      "missing media/image-sequence surface",
    ],
    [
      "required lifecycle and offscreen intent",
      (root: string) =>
        replace(
          root,
          "src/App.tsx",
          '    offscreen: { strategy: "restore-dom" },',
          "",
        ),
      "missing explicit lifecycle/offscreen/fallback evidence",
    ],
    [
      "a required DOM fallback",
      (root: string) =>
        replace(
          root,
          "src/App.tsx",
          [
            '          <WebGLTarget as="section" webgl={surfaceDeclaration}>',
            "            <h1>DOM-first WebGL</h1>",
            "          </WebGLTarget>",
          ].join("\n"),
          '          <WebGLTarget as="section" webgl={surfaceDeclaration} />',
        ),
      "missing explicit lifecycle/offscreen/fallback evidence",
    ],
    [
      "an unmanaged overlay handle",
      (root: string) =>
        replace(
          root,
          "src/effects.ts",
          "      ctx.resources.addDisposable(() => layer.dispose());\n",
          "",
        ),
      "overlay handles must be registered with ctx.resources.addDisposable",
    ],
    [
      "an unmanaged model light handle",
      (root: string) =>
        replace(
          root,
          "src/effects.ts",
          "      ctx.resources.addDisposable(() => glowLight.dispose());\n",
          "",
        ),
      "model handles must be registered with ctx.resources.addDisposable",
    ],
  ])("rejects a consumer with %s", (_name, mutate, message) => {
    const fixtureRoot = copyTemplate();
    mutate(fixtureRoot);

    const result = runVerifier(fixtureRoot);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
  });
});

function collectFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      files.push(...collectFiles(path));
      continue;
    }
    files.push(relative(skillRoot, path).split(sep).join("/"));
  }
  return files.sort();
}

function read(path: string): string {
  return readFileSync(resolve(skillRoot, path), "utf8");
}

function copyTemplate(options: { installTypeScript?: boolean } = {}): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "viselora-skill-consumer-"));
  fixtureRoots.push(fixtureRoot);
  cpSync(templateRoot, fixtureRoot, { recursive: true });
  if (options.installTypeScript !== false) {
    const nodeModules = resolve(fixtureRoot, "node_modules");
    mkdirSync(nodeModules, { recursive: true });
    symlinkSync(resolve(repoRoot, "node_modules/typescript"), resolve(nodeModules, "typescript"), "dir");
  }
  return fixtureRoot;
}

function append(root: string, path: string, content: string): void {
  const absolutePath = resolve(root, path);
  writeFileSync(absolutePath, readFileSync(absolutePath, "utf8") + content);
}

function replace(root: string, path: string, search: string, replacement: string): void {
  const absolutePath = resolve(root, path);
  const content = readFileSync(absolutePath, "utf8");
  expect(content).toContain(search);
  writeFileSync(absolutePath, content.replace(search, replacement));
}

function replaceAll(root: string, path: string, search: string, replacement: string): void {
  const absolutePath = resolve(root, path);
  const content = readFileSync(absolutePath, "utf8");
  expect(content).toContain(search);
  writeFileSync(absolutePath, content.split(search).join(replacement));
}

function runVerifier(root: string) {
  return spawnSync(process.execPath, [verifierPath, root], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}
