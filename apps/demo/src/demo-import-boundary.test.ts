import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

type DemoImportViolation = {
  file: string;
  specifier: string;
  reason: string;
};

type FindDemoImportViolations = (options?: {
  workspaceRoot?: string;
  demoSourceDir?: string;
}) => Promise<DemoImportViolation[]>;

const tempDirs: string[] = [];

describe("demo import boundary", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (directory) => {
        await import("node:fs/promises").then(({ rm }) =>
          rm(directory, { recursive: true, force: true }),
        );
      }),
    );
  });

  test("allows public runtime imports and demo-local relative imports", async () => {
    const demoSourceDir = await createTempDemoSource();

    await writeFile(
      path.join(demoSourceDir, "App.tsx"),
      [
        'import { createWebGLRuntime } from "@project/dom-webgl-runtime";',
        'import { WebGLRuntime, WebGLTarget } from "@project/dom-webgl-runtime/react";',
        'import "./demo.css";',
        'import { helper } from "./helper";',
        "",
        "helper();",
        "void WebGLRuntime;",
        "void WebGLTarget;",
        "void createWebGLRuntime;",
      ].join("\n"),
    );
    await writeFile(path.join(demoSourceDir, "helper.ts"), "export function helper() {}\n");
    await writeFile(path.join(demoSourceDir, "demo.css"), ".demo {}\n");

    const findDemoImportViolations = await loadFindDemoImportViolations();
    const violations = await findDemoImportViolations({
      demoSourceDir,
      workspaceRoot: path.dirname(path.dirname(path.dirname(demoSourceDir))),
    });

    expect(violations).toEqual([]);
  });

  test("rejects runtime internal imports through alias, workspace path, and relative escape", async () => {
    const tempRoot = await createTempWorkspace();
    const demoSourceDir = path.join(tempRoot, "apps", "demo", "src");
    const runtimeInternalDir = path.join(
      tempRoot,
      "packages",
      "dom-webgl-runtime",
      "src",
      "lib",
      "react",
    );
    const runtimeSourceDir = path.join(tempRoot, "packages", "dom-webgl-runtime", "src");

    await mkdir(demoSourceDir, { recursive: true });
    await mkdir(runtimeInternalDir, { recursive: true });
    await mkdir(runtimeSourceDir, { recursive: true });
    await writeFile(path.join(runtimeInternalDir, "runtimeContext.tsx"), "export {};\n");
    await writeFile(path.join(runtimeSourceDir, "index.ts"), "export {};\n");
    await writeFile(path.join(runtimeSourceDir, "react.ts"), "export {};\n");
    await writeFile(
      path.join(demoSourceDir, "bad.ts"),
      [
        'import "@project/dom-webgl-runtime/src/lib/react/runtimeContext";',
        'import "packages/dom-webgl-runtime/src/index";',
        'import "packages/dom-webgl-runtime/src/react";',
        'import "packages/dom-webgl-runtime/src/lib/react/runtimeContext";',
        'require("@project/dom-webgl-runtime/src/lib/react/runtimeContext");',
        'import "../../../packages/dom-webgl-runtime/src/index";',
        'import "../../../packages/dom-webgl-runtime/src/react";',
        'import "../../../packages/dom-webgl-runtime/src/lib/react/runtimeContext";',
      ].join("\n"),
    );

    const findDemoImportViolations = await loadFindDemoImportViolations();
    const violations = await findDemoImportViolations({
      demoSourceDir,
      workspaceRoot: tempRoot,
    });

    expect(violations.map(({ specifier }: DemoImportViolation) => specifier)).toEqual([
      "@project/dom-webgl-runtime/src/lib/react/runtimeContext",
      "packages/dom-webgl-runtime/src/index",
      "packages/dom-webgl-runtime/src/react",
      "packages/dom-webgl-runtime/src/lib/react/runtimeContext",
      "@project/dom-webgl-runtime/src/lib/react/runtimeContext",
      "../../../packages/dom-webgl-runtime/src/index",
      "../../../packages/dom-webgl-runtime/src/react",
      "../../../packages/dom-webgl-runtime/src/lib/react/runtimeContext",
    ]);
  });

  test("rejects removed effect preset subpath imports", async () => {
    const demoSourceDir = await createTempDemoSource();

    await writeFile(
      path.join(demoSourceDir, "bad-effects.ts"),
      'import { pointerTiltEffect } from "@project/dom-webgl-runtime/effects";\n',
    );

    const findDemoImportViolations = await loadFindDemoImportViolations();
    const violations = await findDemoImportViolations({
      demoSourceDir,
      workspaceRoot: path.dirname(path.dirname(path.dirname(demoSourceDir))),
    });

    expect(violations).toEqual([
      expect.objectContaining({
        specifier: "@project/dom-webgl-runtime/effects",
        reason: "non-public runtime alias import",
      }),
    ]);
  });

  test("ignores colocated test files when scanning demo runtime imports", async () => {
    const demoSourceDir = await createTempDemoSource();

    await writeFile(
      path.join(demoSourceDir, "demo-import-boundary.test.ts"),
      'import "@project/dom-webgl-runtime/src/lib/react/runtimeContext";\n',
    );

    const findDemoImportViolations = await loadFindDemoImportViolations();
    const violations = await findDemoImportViolations({
      demoSourceDir,
      workspaceRoot: path.dirname(path.dirname(path.dirname(demoSourceDir))),
    });

    expect(violations).toEqual([]);
  });
});

async function createTempDemoSource(): Promise<string> {
  const tempRoot = await createTempWorkspace();
  const demoSourceDir = path.join(tempRoot, "apps", "demo", "src");
  await mkdir(demoSourceDir, { recursive: true });
  return demoSourceDir;
}

async function createTempWorkspace(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "demo-import-boundary-"));
  tempDirs.push(directory);
  return directory;
}

async function loadFindDemoImportViolations(): Promise<FindDemoImportViolations> {
  // TypeScript does not resolve the colocated .mjs helper declaration under the current bundler setup.
  // @ts-expect-error runtime import is covered by the targeted test below.
  const module = (await import("../../../scripts/assert-demo-public-imports.mjs")) as {
    findDemoImportViolations: FindDemoImportViolations;
  };

  return module.findDemoImportViolations;
}
