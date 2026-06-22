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
        const restoreDomLifecycle = {
          hideWhenReady: true,
          hideMode: "self",
          offscreen: {
            strategy: "restore-dom",
            warmTtlMs: 0,
          },
        } satisfies WebGLLifecycleDeclaration;
        const parkLifecycle = {
          hideWhenReady: true,
          hideMode: "self",
          offscreen: {
            strategy: "park",
            warmTtlMs: 1500,
          },
        } satisfies WebGLLifecycleDeclaration;
		        const arrayEffects = [
		          { kind: "app.surface", opacity: 0.86 },
		          { kind: "app.pointerTilt", strength: 0.6, maxDegrees: 8 },
		        ] satisfies WebGLEffectsDeclaration;
		        const legacyEffects = {
		          material: { kind: "solid" as const, color: 0x111827, opacity: 0.82 },
		          motion: { kind: "pointer-tilt" as const, strength: 0.6, maxDegrees: 8 },
		        };
		        // @ts-expect-error legacy object-form effects are no longer public contract.
		        legacyEffects satisfies WebGLEffectsDeclaration;

		        const declaration = {
		          key: "hero.model",
		          source,
	          renderRole,
		          scroll: pageScroll,
		          pointer,
		          lifecycle,
		          effects: arrayEffects,
		        } satisfies WebGLDeclaration;

        const gateDeclaration = {
          key: "hero.scene",
          scroll: gateScroll,
        } satisfies WebGLDeclaration;
        const legacyDeclaration = {
          key: "card.surface",
          source: { kind: "snapshot", mode: "element" },
          effects: legacyEffects,
        };

        declaration.key satisfies string;
        gateDeclaration.scroll satisfies WebGLScrollBehavior | undefined;
        // @ts-expect-error legacy object-form effects are no longer public contract.
        legacyDeclaration satisfies WebGLDeclaration;
        subtreeLifecycle satisfies WebGLLifecycleDeclaration;
        restoreDomLifecycle satisfies WebGLLifecycleDeclaration;
        parkLifecycle satisfies WebGLLifecycleDeclaration;
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
          offscreen: {
            // @ts-expect-error offscreen strategy only supports restore-dom or park.
            strategy: "keep-active",
          },
        } satisfies WebGLLifecycleDeclaration);

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
		          effects: {
		            // @ts-expect-error target effects must be array-form declarations.
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
