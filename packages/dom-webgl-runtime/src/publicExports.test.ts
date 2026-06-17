import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

describe("public package exports", () => {
  test("root entrypoint exposes runtime APIs without internal helpers", async () => {
    const rootApi = await import("./index");

    expect(rootApi.createWebGLRuntime).toEqual(expect.any(Function));
    expect(rootApi).not.toHaveProperty("createTargetRegistry");
  });

  test("React entrypoint exposes the public React adapter", async () => {
    const reactApi = await import("./react");

    expect(reactApi.WebGLRuntime).toEqual(expect.any(Function));
    expect(reactApi.WebGLTarget).toEqual(expect.any(Function));
    expect(reactApi.useWebGLRuntime).toEqual(expect.any(Function));
  });

  test("root entrypoint type-checks public types and hides internal types", () => {
    const repoRoot = process.cwd();
    const tempDir = mkdtempSync(resolve(tmpdir(), "dom-webgl-public-exports-"));
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
        import { createWebGLRuntime } from "${importPath}";
        import type {
          WebGLDebugState,
          WebGLDeclaration,
          WebGLFrameInput,
          WebGLLifecycleDeclaration,
          WebGLImageSourceDeclaration,
          WebGLModelSourceDeclaration,
          WebGLPointerDeclaration,
          WebGLPointerState,
          WebGLRenderRole,
          WebGLResourceStatus,
          WebGLRuntime,
          WebGLRuntimeOptions,
          WebGLScrollBehavior,
          WebGLSnapshotSourceDeclaration,
          WebGLSourceDeclaration,
          WebGLVideoSourceDeclaration,
        } from "${importPath}";

        // @ts-expect-error Target registry is an internal pipeline helper.
        import { createTargetRegistry } from "${importPath}";
        // @ts-expect-error Target descriptors are internal pipeline state.
        import type { TargetDescriptor } from "${importPath}";

        createWebGLRuntime satisfies (
          options: WebGLRuntimeOptions,
        ) => WebGLRuntime;

        const renderRole = "model" satisfies WebGLRenderRole;
        const snapshotSource = {
          kind: "snapshot",
          mode: "text",
        } satisfies WebGLSnapshotSourceDeclaration;
        const imageSource = {
          kind: "image",
          src: "/textures/card.png",
        } satisfies WebGLImageSourceDeclaration;
        const videoSource = {
          kind: "video",
          src: "/media/loop.mp4",
        } satisfies WebGLVideoSourceDeclaration;
        const modelSource = {
          kind: "model",
          format: "glb",
          src: "/models/hero.glb",
        } satisfies WebGLModelSourceDeclaration;

        snapshotSource satisfies WebGLSourceDeclaration;
        imageSource satisfies WebGLSourceDeclaration;
        videoSource satisfies WebGLSourceDeclaration;
        modelSource satisfies WebGLSourceDeclaration;

        const pointerDeclaration = {
          move: true,
          click: true,
          drag: true,
        } satisfies WebGLPointerDeclaration;
        const scroll = { type: "page" } satisfies WebGLScrollBehavior;
        const lifecycle = {
          hideWhenReady: true,
        } satisfies WebGLLifecycleDeclaration;

        const declaration = {
          key: "hero.model",
          source: modelSource,
          renderRole,
          scroll,
          pointer: pointerDeclaration,
          lifecycle,
        } satisfies WebGLDeclaration;

        const pointer = {
          x: 0,
          y: 0,
          normalizedX: 0,
          normalizedY: 0,
          isInside: false,
          isDown: false,
          downTime: 0,
          pressDuration: 0,
          isDragging: false,
          dragStartX: 0,
          dragStartY: 0,
          dragDeltaX: 0,
          dragDeltaY: 0,
          clickCount: 0,
        } satisfies WebGLPointerState;
        const frame = {
          time: 10,
          delta: 10,
          scroll: {
            mode: "page",
            pageProgress: 0,
            direction: 0,
            velocity: 0,
          },
          pointer,
        } satisfies WebGLFrameInput;
        const resourceStatus = "idle" satisfies WebGLResourceStatus;
        const debugState = {
          targetCount: 1,
          renderableCount: 1,
          currentScrollMode: "page",
          pointer: frame.pointer,
          targets: [
            {
              key: declaration.key,
              sourceKind: "model",
              renderRole: declaration.renderRole,
              resourceStatus,
              visible: true,
            },
          ],
        } satisfies WebGLDebugState;

        debugState.targets[0]?.key satisfies string | undefined;
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
