import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

describe("WebGLDeclaration public types", () => {
  test("accepts the phase 1 schema and rejects Three.js policy fields", () => {
    const repoRoot = process.cwd();
    const tempDir = mkdtempSync(resolve(tmpdir(), "dom-webgl-types-"));
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
        import type {
          WebGLDeclaration,
          WebGLLifecycleDeclaration,
          WebGLPointerDeclaration,
          WebGLRenderRole,
          WebGLScrollBehavior,
          WebGLSourceDeclaration,
        } from "${importPath}";

        const source = {
          kind: "model",
          format: "glb",
          src: "/models/hero.glb",
        } satisfies WebGLSourceDeclaration;

        const renderRole = "model" satisfies WebGLRenderRole;
        const scroll = { type: "page" } satisfies WebGLScrollBehavior;
        const pointer = {
          move: true,
          click: true,
          drag: true,
        } satisfies WebGLPointerDeclaration;
        const lifecycle = {
          hideWhenReady: true,
        } satisfies WebGLLifecycleDeclaration;

        const declaration = {
          key: "hero.model",
          source,
          renderRole,
          scroll,
          pointer,
          lifecycle,
        } satisfies WebGLDeclaration;

        declaration.key satisfies string;

        ({
          key: "hero.surface",
          // @ts-expect-error renderOrder is an internal render policy detail.
          renderOrder: 10,
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error transparent is an internal render policy detail.
          transparent: true,
        } satisfies WebGLDeclaration);

        ({
          key: "hero.surface",
          // @ts-expect-error depthWrite is an internal render policy detail.
          depthWrite: false,
        } satisfies WebGLDeclaration);
      `,
    );

    try {
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
      const diagnostics = ts.getPreEmitDiagnostics(program);

      expect(formatDiagnostics(diagnostics)).toBe("");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
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
