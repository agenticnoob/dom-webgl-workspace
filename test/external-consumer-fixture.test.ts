import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";

const fixtureRoots: string[] = [];
afterEach(() => {
  for (const root of fixtureRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "viselora-fixture-contract-"));
  fixtureRoots.push(root);
  const module = resolve("scripts/external-consumer-fixture.mjs");
  const source = `import { createExternalConsumerFixture } from ${JSON.stringify(module)}; createExternalConsumerFixture(...process.argv.slice(1));`;
  const core = resolve(tmpdir(), "viselora-core-fixture.tgz");
  const adapters = resolve(tmpdir(), "viselora-adapters-fixture.tgz");
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source, root, core, adapters],
    { encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  return {
    root,
    core,
    adapters,
    read: (path: string) => readFileSync(resolve(root, path), "utf8"),
  };
}

describe("isolated R3F consumer fixture", () => {
  test("installs packed public entrypoints with explicit native dependencies", () => {
    const { root, core, adapters, read } = fixture();
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.dependencies).toMatchObject({
      "@viselora/dom-webgl": `file:${core}`,
      "@viselora/scroll-adapters": `file:${adapters}`,
      "@react-three/fiber": "^9.8.1",
      react: expect.any(String),
      three: expect.any(String),
    });
    for (const file of [
      "src/App.tsx",
      "src/main.tsx",
      "scripts/verify-ssr.mjs",
      "test/runtime.test.tsx",
      "e2e/capabilities.spec.ts",
      "public/models/hero.glb",
    ])
      expect(existsSync(resolve(root, file))).toBe(true);
    expect(read("tsconfig.json")).not.toContain('"paths"');
    expect(read("src/App.tsx")).not.toMatch(
      /packages\/dom-webgl|defineWebGL|WebGLMesh|WebGLModel/,
    );
  });

  test("retains real GPU, context-loss fallback, progression and remount gates", () => {
    const { read } = fixture();
    const browser = read("e2e/capabilities.spec.ts");
    expect(browser).toContain('page.on("pageerror"');
    expect(browser).toContain("toHaveCount(1)");
    expect(browser).toContain("toHaveCount(0)");
    expect(browser).toContain("WEBGL_lose_context");
    expect(browser).toContain("changedPixels");
    expect(browser).toContain("toBeGreaterThan(2000)");
    expect(browser).toContain("expect(errors).toEqual([])");
    expect(read("src/App.tsx")).toContain("useLoader(GLTFLoader");
    expect(read("src/App.tsx")).toContain("<meshPhysicalMaterial");
    expect(read("playwright.config.ts")).toContain('name: "chromium"');
  });

  test("checks actual server rendering with browser globals absent", () => {
    const { read } = fixture();
    const ssr = read("scripts/verify-ssr.mjs");
    expect(ssr).toContain("delete globalThis.window");
    expect(ssr).toContain("delete globalThis.document");
    expect(ssr).toContain("renderToString(createElement");
    for (const entry of [
      "@viselora/dom-webgl",
      "@viselora/dom-webgl/react",
      "@viselora/scroll-adapters",
      "@viselora/scroll-adapters/react",
    ])
      expect(ssr).toContain(`import("${entry}")`);
  });
});
