import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

describe("runtime state public types", () => {
  test("exports frame, pointer, debug, and resource status types", () => {
    const repoRoot = process.cwd();
    const tempDir = mkdtempSync(resolve(tmpdir(), "dom-webgl-state-types-"));
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
          WebGLDebugState,
          WebGLFrameInput,
          WebGLPointerState,
          WebGLResourceStatus,
        } from "${importPath}";

        const pointer = {
          x: 10,
          y: 20,
          normalizedX: -0.5,
          normalizedY: 0.25,
          isInside: true,
          isDown: false,
          downTime: 0,
          pressDuration: 0,
          isDragging: false,
          dragStartX: 10,
          dragStartY: 20,
          dragDeltaX: 0,
          dragDeltaY: 0,
          lastClickTime: 100,
          clickCount: 1,
        } satisfies WebGLPointerState;

        const frame = {
          time: 1200,
          delta: 16.67,
          scroll: {
            mode: "page",
            pageProgress: 0.4,
            direction: 1,
            velocity: 0.2,
          },
          pointer,
        } satisfies WebGLFrameInput;

        const resourceStatus = "ready" satisfies WebGLResourceStatus;

        const debugState = {
          targetCount: 1,
          renderableCount: 1,
          currentScrollMode: "page",
          pointer: frame.pointer,
          targets: [
            {
              key: "hero.media",
              sourceKind: "image",
              renderRole: "media",
              resourceStatus,
              visible: true,
            },
          ],
        } satisfies WebGLDebugState;

        debugState.targets[0]?.key satisfies string | undefined;

        ({
          time: 1200,
          delta: 16.67,
          scroll: {
            mode: "page",
            pageProgress: 0.4,
            direction: 1,
            velocity: 0.2,
            // @ts-expect-error sceneProgress is outside the Phase 1 public state.
            sceneProgress: 0.5,
          },
          pointer,
        } satisfies WebGLFrameInput);
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
