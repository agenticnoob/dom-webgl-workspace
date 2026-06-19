import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

describe("WebGLDeclaration public types", () => {
  test("accepts scene-gate declarations and still rejects internal policy fields", () => {
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
	          WebGLEffectsDeclaration,
	          WebGLLifecycleState,
	          WebGLLifecycleDeclaration,
	          WebGLMaterialDeclaration,
	          WebGLMotionDeclaration,
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
        const pageScroll = { type: "page" } satisfies WebGLScrollBehavior;
        const gateScroll = {
          type: "gate",
          start: "top top",
          duration: 1,
          release: "both-directions-complete",
        } satisfies WebGLScrollBehavior;
        const pointer = {
          move: true,
          click: true,
          drag: true,
        } satisfies WebGLPointerDeclaration;
        const lifecycle = {
          hideWhenReady: true,
          hideMode: "self",
        } satisfies WebGLLifecycleDeclaration;
	        const lifecycleState =
	          "active" satisfies WebGLLifecycleState;
	        const subtreeLifecycle = {
	          hideWhenReady: true,
	          hideMode: "subtree",
	        } satisfies WebGLLifecycleDeclaration;
        const material = {
          kind: "solid",
          color: 0x111827,
          opacity: 0.82,
        } satisfies WebGLMaterialDeclaration;
        const surfaceMaterial = {
          kind: "surface",
          color: 0x111827,
          opacity: 0.86,
          radius: 18,
        } satisfies WebGLMaterialDeclaration;
	        const motion = {
	          kind: "pointer-tilt",
	          strength: 0.6,
	          maxDegrees: 8,
	        } satisfies WebGLMotionDeclaration;
	        const effects = {
	          material,
	          motion,
	        } satisfies WebGLEffectsDeclaration;

	        const declaration = {
	          key: "hero.model",
	          source,
	          renderRole,
	          scroll: pageScroll,
	          pointer,
	          lifecycle,
	          effects,
	        } satisfies WebGLDeclaration;

        const gateDeclaration = {
          key: "hero.scene",
          scroll: gateScroll,
        } satisfies WebGLDeclaration;
        const surfaceDeclaration = {
          key: "card.surface",
          source: { kind: "snapshot", mode: "element" },
          effects: {
            material: surfaceMaterial,
          },
        } satisfies WebGLDeclaration;

        declaration.key satisfies string;
        gateDeclaration.scroll satisfies WebGLScrollBehavior | undefined;
        surfaceDeclaration.effects?.material?.kind satisfies "surface";
        subtreeLifecycle satisfies WebGLLifecycleDeclaration;
        lifecycleState satisfies
          | "declared"
          | "preloading"
          | "loaded"
          | "mounted"
          | "active"
          | "inactive"
          | "paused"
          | "disposed"
          | "error";

        ({
          hideWhenReady: true,
          // @ts-expect-error hideMode only supports high-level fallback modes.
          hideMode: "children",
        } satisfies WebGLLifecycleDeclaration);

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

	        ({
	          key: "hero.surface",
	          // @ts-expect-error effect is not part of the public declaration contract.
	          effect: "blur",
	        } satisfies WebGLDeclaration);

	        ({
	          key: "hero.surface",
	          // @ts-expect-error effects must be a built-in effect declaration object.
	          effects: ["blur"],
	        } satisfies WebGLDeclaration);

	        ({
	          key: "hero.surface",
	          // @ts-expect-error only built-in legacy material kinds are supported.
	          effects: {
	            material: {
	              kind: "gradient",
	            },
	          },
	        } satisfies WebGLDeclaration);

	        ({
	          key: "card.surface",
	          // @ts-expect-error legacy surface colors are declaration-owned numeric values.
	          effects: {
	            material: {
	              kind: "surface",
	              color: "rgb(17, 24, 39)",
	            },
	          },
        } satisfies WebGLDeclaration);

	        ({
	          key: "hero.surface",
	          effects: {
	            // @ts-expect-error custom effect callbacks are not public API.
	            custom: () => undefined,
	          },
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
