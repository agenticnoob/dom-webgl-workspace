import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

import {
  getFixtureDiagnostics,
  withTypecheckLock,
} from "../../helpers/typecheck";
import type { WebGLRenderRole } from "../../../src/lib/types";
import { compileRenderPolicy, toSceneObjectOrdering } from "../../../src/lib/render/renderPolicy";

const TYPECHECK_TEST_TIMEOUT_MS = 180_000;

describe("compileRenderPolicy", () => {
  test("assigns stable render bands in semantic role order", () => {
    const roles = [
      "surface",
      "content",
      "media",
      "model",
      "overlay",
    ] satisfies WebGLRenderRole[];

    const bands = roles.map((role) => compileRenderPolicy(role).band);

    expect(bands).toEqual([0, 1, 2, 3, 4]);
    expect([...bands].sort((a, b) => a - b)).toEqual(bands);
  });

  test("compiles roles into internal policy fields", () => {
    expect(compileRenderPolicy("surface")).toEqual({
      role: "surface",
      band: 0,
      depthMode: "flat",
      opacityMode: "alpha",
    });
    expect(compileRenderPolicy("content")).toEqual({
      role: "content",
      band: 1,
      depthMode: "flat",
      opacityMode: "alpha",
    });
    expect(compileRenderPolicy("media")).toEqual({
      role: "media",
      band: 2,
      depthMode: "flat",
      opacityMode: "source",
    });
    expect(compileRenderPolicy("model")).toEqual({
      role: "model",
      band: 3,
      depthMode: "model",
      opacityMode: "alpha",
    });
    expect(compileRenderPolicy("overlay")).toEqual({
      role: "overlay",
      band: 4,
      depthMode: "flat",
      opacityMode: "alpha",
    });
  });

  test("maps policies to deterministic internal scene object ordering", () => {
    expect(toSceneObjectOrdering(compileRenderPolicy("surface"))).toEqual({
      renderOrder: 0,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    expect(toSceneObjectOrdering(compileRenderPolicy("content"))).toEqual({
      renderOrder: 100,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    expect(toSceneObjectOrdering(compileRenderPolicy("media"))).toEqual({
      renderOrder: 200,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    expect(toSceneObjectOrdering(compileRenderPolicy("model"))).toEqual({
      renderOrder: 300,
      transparent: true,
      depthWrite: true,
      depthTest: true,
    });
    expect(toSceneObjectOrdering(compileRenderPolicy("overlay"))).toEqual({
      renderOrder: 400,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  });

  test("keeps flat DOM and media roles in the DOM-ordered transparent queue", () => {
    for (const role of ["surface", "content", "media", "overlay"] as const) {
      const ordering = toSceneObjectOrdering(compileRenderPolicy(role));

      expect(ordering.transparent).toBe(true);
      expect(ordering.depthWrite).toBe(false);
      expect(ordering.depthTest).toBe(false);
    }
  });

  test("keeps model role depth-enabled while still receiving render ordering", () => {
    const ordering = toSceneObjectOrdering(compileRenderPolicy("model"));

    expect(ordering.transparent).toBe(true);
    expect(ordering.depthWrite).toBe(true);
    expect(ordering.depthTest).toBe(true);
  });

  test("keeps render policy fields out of the public declaration", async () => {
    const repoRoot = process.cwd();
    const tempDir = mkdtempSync(resolve(tmpdir(), "dom-webgl-policy-types-"));
    const fixturePath = resolve(tempDir, "fixture.ts");
    const indexPath = resolve(repoRoot, "packages/dom-webgl-runtime/src/index.ts");
    const relativeIndexPath = relative(dirname(fixturePath), indexPath)
      .split(sep)
      .join("/");
    const importPath = relativeIndexPath.startsWith(".")
      ? relativeIndexPath
      : `./${relativeIndexPath}`;

    writeFileSync(
      fixturePath,
      `
        import type { WebGLDeclaration } from "${importPath}";

        ({
          key: "hero.surface",
          // @ts-expect-error band is an internal render policy field.
          band: 0,
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error depthMode is an internal render policy field.
          depthMode: "flat",
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error opacityMode is an internal render policy field.
          opacityMode: "opaque",
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error renderOrder is a Three.js policy detail.
          renderOrder: 1,
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error zIndex is not a public WebGL declaration field.
          zIndex: 1,
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error layer is not a public WebGL declaration field.
          layer: 1,
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error transparent is a Three.js policy detail.
          transparent: true,
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error depthWrite is a Three.js policy detail.
          depthWrite: false,
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error depthTest is a Three.js policy detail.
          depthTest: false,
        } satisfies WebGLDeclaration);
      `,
    );

    try {
      const diagnostics = await withTypecheckLock(() => {
        const configPath = resolve(repoRoot, "tsconfig.base.json");
        const configFile = ts.readConfigFile(configPath, (fileName) =>
          readFileSync(fileName, "utf8"),
        );
        const parsedConfig = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          repoRoot,
          {
            noEmit: true,
            allowImportingTsExtensions: true,
            types: [],
          },
          configPath,
        );
        const program = ts.createProgram(
          [fixturePath, indexPath],
          parsedConfig.options,
        );

        return getFixtureDiagnostics(program, fixturePath);
      });

      expect(formatDiagnostics(diagnostics)).toBe("");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, TYPECHECK_TEST_TIMEOUT_MS);
});

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n",
      );

      if (!diagnostic.file || diagnostic.start === undefined) {
        return message;
      }

      const position = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start,
      );

      return `${diagnostic.file.fileName}:${position.line + 1}:${
        position.character + 1
      } - ${message}`;
    })
    .join("\n");
}
