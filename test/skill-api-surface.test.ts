import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const generator = resolve(repoRoot, "skills/viselora-dom-webgl/scripts/generate-api-surface.mjs");
const coverage = resolve(repoRoot, "skills/viselora-dom-webgl/scripts/check-api-coverage.mjs");
const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("Viselora public API surface", () => {
  test("current API coverage passes", () => {
    const result = run(coverage, ["--root", repoRoot]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Viselora API coverage passed");
  });

  test("current generated API surface is fresh", () => {
    const result = run(generator, ["--check", "--root", repoRoot]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("renders deterministic alphabetical entrypoint and symbol output", () => {
    const root = createFixture();
    const first = run(generator, ["--root", root]);
    expect(first.status).toBe(0);
    const output = read(root, "skills/viselora-dom-webgl/references/api-surface.generated.md");
    expect(output.indexOf("## `@viselora/dom-webgl`")).toBeLessThan(output.indexOf("## `@viselora/dom-webgl/react`"));
    expect(output.indexOf("| alpha | value |")).toBeLessThan(output.indexOf("| zeta | value |"));
    const second = run(generator, ["--check", "--root", root]);
    expect(second.status).toBe(0);
  });

  test("reports stale generated output after a declaration changes", () => {
    const root = createFixture();
    expect(run(generator, ["--root", root]).status).toBe(0);
    append(root, "packages/dom-webgl-runtime/dist/index.d.ts", "\nexport declare function added(): void;\nexport { added };\n");
    const result = run(generator, ["--check", "--root", root]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("api-surface.generated.md is stale");
  });

  test("reports a missing public value mapping with entrypoint and symbol", () => {
    const root = createCoverageFixture();
    const manifest = json(root, "skills/viselora-dom-webgl/references/api-coverage.json");
    delete manifest.entrypoints["@viselora/dom-webgl"].alpha;
    writeJson(root, "skills/viselora-dom-webgl/references/api-coverage.json", manifest);
    const result = run(coverage, ["--root", root]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("@viselora/dom-webgl#alpha");
  });

  test("reports a stale mapped public value", () => {
    const root = createCoverageFixture();
    const manifest = json(root, "skills/viselora-dom-webgl/references/api-coverage.json");
    manifest.entrypoints["@viselora/dom-webgl"].removed = manifest.entrypoints["@viselora/dom-webgl"].alpha;
    writeJson(root, "skills/viselora-dom-webgl/references/api-coverage.json", manifest);
    const result = run(coverage, ["--root", root]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("stale mapping");
    expect(result.stderr).toContain("@viselora/dom-webgl#removed");
  });

  test("reports an exported type missing from the generated index", () => {
    const root = createCoverageFixture();
    const path = "skills/viselora-dom-webgl/references/api-surface.generated.md";
    write(root, path, read(root, path).split("\n").filter((line) => !line.includes("| AlphaOptions | type |")).join("\n"));
    const result = run(coverage, ["--root", root]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing type");
    expect(result.stderr).toContain("AlphaOptions");
  });

  test.each(["package", "skill", "coverage", "status"])("reports a %s version mismatch", (source) => {
    const root = createCoverageFixture();
    if (source === "package") {
      const pkg = json(root, "packages/dom-webgl-runtime/package.json");
      pkg.version = "0.1.0-alpha.1";
      writeJson(root, "packages/dom-webgl-runtime/package.json", pkg);
    } else if (source === "skill") {
      write(root, "skills/viselora-dom-webgl/SKILL.md", read(root, "skills/viselora-dom-webgl/SKILL.md").replace("0.1.0-alpha.0", "0.1.0-alpha.1"));
    } else if (source === "coverage") {
      const manifest = json(root, "skills/viselora-dom-webgl/references/api-coverage.json");
      manifest.compatiblePackageVersion = "0.1.0-alpha.1";
      writeJson(root, "skills/viselora-dom-webgl/references/api-coverage.json", manifest);
    } else {
      write(root, "skills/viselora-dom-webgl/references/capability-status.md", read(root, "skills/viselora-dom-webgl/references/capability-status.md").replace("0.1.0-alpha.0", "0.1.0-alpha.1"));
    }
    const result = run(coverage, ["--root", root]);
    expect(result.status).toBe(1);
    expect(result.stderr.toLowerCase()).toContain("version mismatch");
  });

  test("reports a mapped capability without a status row", () => {
    const root = createCoverageFixture();
    write(root, "skills/viselora-dom-webgl/references/capability-status.md", read(root, "skills/viselora-dom-webgl/references/capability-status.md").replace(/^\| public-imports-ssr .*$/m, ""));
    const result = run(coverage, ["--root", root]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing status");
    expect(result.stderr).toContain("public-imports-ssr");
  });
});

function createFixture(): string {
  const root = mkdtempSync(resolve(tmpdir(), "viselora-api-"));
  fixtures.push(root);
  writeJson(root, "packages/dom-webgl-runtime/package.json", { name: "@viselora/dom-webgl", version: "0.1.0-alpha.0" });
  writeJson(root, "packages/dom-webgl-scroll-adapters/package.json", { name: "@viselora/scroll-adapters", version: "0.1.0-alpha.0", dependencies: { "@viselora/dom-webgl": "0.1.0-alpha.0" } });
  write(root, "packages/dom-webgl-runtime/dist/index.d.ts", "declare function zeta(): void;\ndeclare function alpha(): void;\ntype AlphaOptions = { enabled: boolean };\nexport { alpha, type AlphaOptions, zeta };\n");
  write(root, "packages/dom-webgl-runtime/dist/react.d.ts", "declare function WebGLRuntime(): null;\ntype WebGLRuntimeProps = { children?: unknown };\nexport { WebGLRuntime, type WebGLRuntimeProps };\n");
  write(root, "packages/dom-webgl-scroll-adapters/dist/index.d.ts", "declare function createBridge(): void;\ntype Bridge = { dispose(): void };\nexport { type Bridge, createBridge };\n");
  write(root, "packages/dom-webgl-scroll-adapters/dist/react.d.ts", "declare function WebGLScrollRuntime(): null;\ntype WebGLScrollRuntimeProps = { children?: unknown };\nexport { WebGLScrollRuntime, type WebGLScrollRuntimeProps };\n");
  write(root, "skills/viselora-dom-webgl/references/api-surface.generated.md", "");
  return root;
}

function createCoverageFixture(): string {
  const root = createFixture();
  expect(run(generator, ["--root", root]).status).toBe(0);
  write(root, "skills/viselora-dom-webgl/SKILL.md", "---\nname: viselora-dom-webgl\ndescription: Use when testing.\n---\n\nCompatible package version: 0.1.0-alpha.0\n");
  write(root, "skills/viselora-dom-webgl/references/api-effects-rendering.md", "# Effects\n\n## Runtime creation\n");
  write(root, "skills/viselora-dom-webgl/references/api-lifecycle-debug.md", "# Lifecycle\n\n## Lifecycle\n");
  write(root, "skills/viselora-dom-webgl/references/api-scroll-interaction.md", "# Scroll\n\n## Scroll runtime\n");
  write(root, "skills/viselora-dom-webgl/references/capability-status.md", "# Capability Status\n\nCompatible package version: 0.1.0-alpha.0\n\n| Capability id | Status | Required evidence | Consumer guidance |\n| --- | --- | --- | --- |\n| public-imports-ssr | verified | imports | use public entrypoints |\n| single-runtime-canvas | verified | one canvas | keep one owner |\n| shared-scroll-progress | verified | scroll | use one timeline |\n");
  writeJson(root, "skills/viselora-dom-webgl/references/api-coverage.json", {
    schemaVersion: 1,
    compatiblePackageVersion: "0.1.0-alpha.0",
    entrypoints: {
      "@viselora/dom-webgl": {
        alpha: { reference: "api-effects-rendering.md", section: "Runtime creation", capability: "public-imports-ssr" },
        zeta: { reference: "api-effects-rendering.md", section: "Runtime creation", capability: "public-imports-ssr" },
      },
      "@viselora/dom-webgl/react": {
        WebGLRuntime: { reference: "api-lifecycle-debug.md", section: "Lifecycle", capability: "single-runtime-canvas" },
      },
      "@viselora/scroll-adapters": {
        createBridge: { reference: "api-scroll-interaction.md", section: "Scroll runtime", capability: "shared-scroll-progress" },
      },
      "@viselora/scroll-adapters/react": {
        WebGLScrollRuntime: { reference: "api-scroll-interaction.md", section: "Scroll runtime", capability: "shared-scroll-progress" },
      },
    },
  });
  return root;
}

function run(path: string, args: readonly string[]) {
  return spawnSync(process.execPath, [path, ...args], { cwd: repoRoot, encoding: "utf8" });
}

function write(root: string, path: string, content: string): void {
  const absolute = resolve(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function append(root: string, path: string, content: string): void {
  write(root, path, read(root, path) + content);
}

function read(root: string, path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function json(root: string, path: string): any {
  return JSON.parse(read(root, path));
}

function writeJson(root: string, path: string, value: unknown): void {
  write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}
