import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const modulePath = resolve(repoRoot, "scripts/external-consumer-fixture.mjs");
const fixtureRoots: string[] = [];

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("external consumer fixture", () => {
  test("generates an isolated React Vite tarball consumer", () => {
    const root = mkdtempSync(join(tmpdir(), "viselora-fixture-contract-"));
    fixtureRoots.push(root);
    const coreTarball = resolve(tmpdir(), "viselora-core-fixture.tgz");
    const adaptersTarball = resolve(tmpdir(), "viselora-adapters-fixture.tgz");

    const result = runGenerator(root, coreTarball, adaptersTarball);

    expect(result.status).toBe(0);
    expect(requiredFiles.every((file) => existsSync(resolve(root, file)))).toBe(true);
    const packageJson = JSON.parse(read(root, "package.json"));
    expect(packageJson.dependencies).toMatchObject({
      "@viselora/dom-webgl": `file:${coreTarball}`,
      "@viselora/scroll-adapters": `file:${adaptersTarball}`,
      react: expect.any(String),
      "react-dom": expect.any(String),
    });
    expect(packageJson.scripts).toEqual({
      typecheck: "tsc --noEmit",
      test: "vitest run",
      build: "vite build",
    });
  });

  test("uses all four public entrypoints without monorepo escape hatches", () => {
    const root = createFixture();
    const content = requiredFiles.map((file) => read(root, file)).join("\n");

    expect(content).toContain('from "@viselora/dom-webgl"');
    expect(content).toContain('from "@viselora/dom-webgl/react"');
    expect(content).toContain('from "@viselora/scroll-adapters"');
    expect(content).toContain('from "@viselora/scroll-adapters/react"');
    expect(content).not.toMatch(/workspace:|packages\/dom-webgl|compilerOptions[\s\S]*paths/);
    expect(content).not.toContain("@project/");
  });

  test("generates SSR, type, one-canvas target, and production build probes", () => {
    const root = createFixture();
    const app = read(root, "src/App.tsx");
    const effects = read(root, "src/effects.ts");
    const runtimeTest = read(root, "test/runtime.test.tsx");
    const rendererMock = read(root, "test/WebGLRendererMock.ts");
    const vitestConfig = read(root, "vitest.config.ts");
    const ssr = read(root, "scripts/verify-ssr.mjs");

    expect(effects).toContain("const runtimeEffects");
    expect(effects).toContain("defineWebGLSceneObjectEffect");
    expect(effects).toContain('kind: "fixture.sceneObject"');
    expect(app).toContain("<WebGLRuntime");
    expect(app).toContain("effects={runtimeEffects}");
    expect(app).toContain("<WebGLTarget");
    expect(app).toContain("<WebGLScene");
    expect(app).toContain("<WebGLCamera");
    expect(app).toContain("<WebGLRenderPass");
    expect(app).toContain("<WebGLStageBox");
    expect(runtimeTest).toContain("@vitest-environment jsdom");
    expect(runtimeTest).toContain("function (this: HTMLCanvasElement)");
    expect(runtimeTest).toContain('querySelectorAll("canvas")');
    expect(runtimeTest).toContain("targetCount");
    expect(runtimeTest).toContain("fixture.sceneObject");
    expect(runtimeTest).toContain("console.error");
    expect(runtimeTest).toContain("runtimeErrors");
    expect(runtimeTest).toContain("root.unmount()");
    expect(rendererMock).toContain("class WebGLRendererMock");
    expect(vitestConfig).toContain('"three/src/renderers/WebGLRenderer.js"');
    expect(vitestConfig).toContain('mode === "test"');
    expect(vitestConfig).toMatch(/resolve:[\s\S]*alias:\s*\{/);
    expect(vitestConfig).toContain('inline: ["@viselora/dom-webgl"]');
    expect(ssr).toContain('await import("@viselora/dom-webgl")');
    expect(ssr).toContain('await import("@viselora/dom-webgl/react")');
    expect(ssr).toContain('await import("@viselora/scroll-adapters")');
    expect(ssr).toContain('await import("@viselora/scroll-adapters/react")');
  });
});

const requiredFiles = [
  "package.json",
  "tsconfig.json",
  "index.html",
  "src/App.tsx",
  "src/effects.ts",
  "src/main.tsx",
  "scripts/verify-ssr.mjs",
  "vitest.config.ts",
  "test/WebGLRendererMock.ts",
  "test/runtime.test.tsx",
] as const;

function createFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "viselora-fixture-contract-"));
  fixtureRoots.push(root);
  const result = runGenerator(
    root,
    resolve(tmpdir(), "viselora-core-fixture.tgz"),
    resolve(tmpdir(), "viselora-adapters-fixture.tgz"),
  );
  expect(result.status).toBe(0);
  return root;
}

function runGenerator(root: string, coreTarball: string, adaptersTarball: string) {
  const source = [
    `import { createExternalConsumerFixture } from ${JSON.stringify(modulePath)};`,
    "try {",
    "  createExternalConsumerFixture(process.argv[1], process.argv[2], process.argv[3]);",
    "} catch (error) {",
    "  console.error(error instanceof Error ? error.message : String(error));",
    "  process.exitCode = 1;",
    "}",
  ].join("\n");
  return spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source, root, coreTarball, adaptersTarball],
    { encoding: "utf8" },
  );
}

function read(root: string, path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}
