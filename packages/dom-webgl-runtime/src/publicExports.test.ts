import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const TYPECHECK_TEST_TIMEOUT_MS = 30_000;

describe("public package exports", () => {
  test("root entrypoint exposes runtime APIs without internal helpers", async () => {
    const rootApi = await import("./index");

    expect(rootApi.createWebGLRuntime).toEqual(expect.any(Function));
    expect(rootApi.defineWebGLEffect).toEqual(expect.any(Function));
    expect(rootApi).not.toHaveProperty("pointerTiltEffect");
    expect(rootApi).not.toHaveProperty("surfaceBasicEffect");
    expect(rootApi).not.toHaveProperty("createWebGLEffectRegistry");
    expect(rootApi).not.toHaveProperty("createTargetRegistry");
  });

  test("React entrypoint exposes the public React adapter", async () => {
    const reactApi = await import("./react");

    expect(reactApi.WebGLRuntime).toEqual(expect.any(Function));
    expect(reactApi.WebGLTarget).toEqual(expect.any(Function));
    expect(reactApi.useWebGLRuntime).toEqual(expect.any(Function));
  });

  test("package metadata does not expose concrete effect presets", () => {
    const packageJson = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "packages/dom-webgl-runtime/package.json"),
        "utf8",
      ),
    ) as { exports: Record<string, unknown> };

    expect(packageJson.exports).not.toHaveProperty("./effects");
  });

  test("React entrypoint type-checks public gate declarations only", () => {
    const repoRoot = process.cwd();
    const tempDir = mkdtempSync(resolve(repoRoot, ".tmp-dom-webgl-react-exports-"));
    const fixturePath = resolve(tempDir, "fixture.tsx");
    const reactPath = resolve(repoRoot, "packages/dom-webgl-runtime/src/react.ts");
    const relativeReactPath = relative(dirname(fixturePath), reactPath)
      .split(sep)
      .join("/");
    const importPath = relativeReactPath.startsWith(".")
      ? relativeReactPath
      : `./${relativeReactPath}`;

    writeFileSync(
      fixturePath,
      `
		        import { WebGLRuntime, WebGLTarget } from "${importPath}";
		        import type { WebGLRuntimeProps, WebGLTargetProps } from "${importPath}";
		        import type { ReactElement } from "react";
        // @ts-expect-error Runtime internals are not part of the React entrypoint.
        import { createWebGLRuntime } from "${importPath}";
        // @ts-expect-error Scene objects are internal renderer state.
        import type { WebGLSceneObject } from "${importPath}";
        // @ts-expect-error Scene object controllers are internal renderer state.
        import type { WebGLSceneObjectController } from "${importPath}";
        // @ts-expect-error Scene object ordering is an internal render policy detail.
        import type { WebGLSceneObjectOrdering } from "${importPath}";
        // @ts-expect-error Scene adapters are internal renderer state.
        import type { WebGLSceneAdapter } from "${importPath}";
        // @ts-expect-error DOM projection is an internal renderer detail.
        import type { ProjectedDOMRect } from "${importPath}";
        // @ts-expect-error DOM viewport projection is an internal renderer detail.
        import type { DOMViewportSize } from "${importPath}";
        // @ts-expect-error Render policy ordering is internal.
        import type { SceneObjectOrdering } from "${importPath}";

		        WebGLRuntime satisfies unknown;
		        WebGLTarget satisfies unknown;
		        declare const effects: WebGLRuntimeProps["effects"];

		        const runtimeElement = (
		          <WebGLRuntime effects={effects}>
		            <WebGLTarget
		              webgl={{
		                key: "react.custom-effect",
		                effects: [{ kind: "custom.reactEffect" }],
		              }}
		            >
		              <div />
		            </WebGLTarget>
		          </WebGLRuntime>
		        );

		        runtimeElement satisfies ReactElement;

		        const props = {
	          webgl: {
	            key: "hero.gate",
	            scroll: {
	              type: "gate",
	              start: "top top",
	              duration: 1,
	              release: "both-directions-complete",
	            },
	            effects: {
	              material: { kind: "solid", color: 0x111827, opacity: 0.82 },
	              motion: { kind: "pointer-tilt", strength: 0.6, maxDegrees: 8 },
	            },
	          },
	        } satisfies WebGLTargetProps;
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
          jsx: ts.JsxEmit.ReactJSX,
          noEmit: true,
          allowImportingTsExtensions: true,
          types: [],
        },
        configPath,
      );
      const program = ts.createProgram(
        [fixturePath, reactPath],
        parsedConfig.options,
      );
      const diagnostics = ts.getPreEmitDiagnostics(program);

      expect(formatDiagnostics(diagnostics)).toBe("");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, TYPECHECK_TEST_TIMEOUT_MS);

  test("React public provider props use the public runtime type boundary", () => {
    const runtimeContextSource = readFileSync(
      resolve(
        process.cwd(),
        "packages/dom-webgl-runtime/src/lib/react/runtimeContext.tsx",
      ),
      "utf8",
    );

    expect(runtimeContextSource).not.toContain("../renderer/runtime");
    expect(runtimeContextSource).toContain("../types");
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
		        import {
		          createWebGLRuntime,
		          defineWebGLEffect,
		        } from "${importPath}";
			        import type {
			          WebGLDebugState,
			          WebGLDeclaration,
			          WebGLEffectContext,
			          WebGLEffectDefinition,
			          WebGLEffectResourceScope,
			          WebGLEffectSourceHandle,
			          WebGLEffectTargetHandle,
			          WebGLEffectsDeclaration,
			          WebGLFrameInput,
	          WebGLGateScrollBehavior,
	          WebGLLifecycleDeclaration,
	          WebGLImageSourceDeclaration,
	          WebGLMaterialDeclaration,
	          WebGLModelSourceDeclaration,
	          WebGLMotionDeclaration,
	          WebGLPointerDeclaration,
	          WebGLPointerState,
	          WebGLRenderRole,
          WebGLResourceStatus,
          WebGLRuntime,
          WebGLRuntimeOptions,
          WebGLScrollBehavior,
          WebGLSnapshotSourceDeclaration,
          WebGLSolidMaterialDeclaration,
          WebGLSourceDeclaration,
          WebGLSurfaceMaterialDeclaration,
          WebGLVideoSourceDeclaration,
        } from "${importPath}";

        // @ts-expect-error Target registry is an internal pipeline helper.
        import { createTargetRegistry } from "${importPath}";
        // @ts-expect-error Target descriptors are internal pipeline state.
        import type { TargetDescriptor } from "${importPath}";
        // @ts-expect-error Scene objects are internal renderer state.
        import type { WebGLSceneObject } from "${importPath}";
        // @ts-expect-error Scene adapters are internal renderer state.
        import type { WebGLSceneAdapter } from "${importPath}";
        // @ts-expect-error Scene object controllers are internal renderer state.
        import type { WebGLSceneObjectController } from "${importPath}";
        // @ts-expect-error Scene object ordering is internal render state.
        import type { WebGLSceneObjectOrdering } from "${importPath}";
        // @ts-expect-error DOM projection is an internal renderer detail.
        import type { ProjectedDOMRect } from "${importPath}";
        // @ts-expect-error DOM viewport projection is an internal renderer detail.
        import type { DOMViewportSize } from "${importPath}";
        // @ts-expect-error Render policy is an internal compilation result.
        import type { RenderPolicy } from "${importPath}";
	        // @ts-expect-error Render policy ordering is internal.
	        import type { SceneObjectOrdering } from "${importPath}";
	        // @ts-expect-error Effect targets are internal renderable state.
	        import type { WebGLEffectTarget } from "${importPath}";

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
        const pageScroll = { type: "page" } satisfies WebGLScrollBehavior;
        const gateScroll = {
          type: "gate",
          start: "top top",
          duration: 1,
          release: "both-directions-complete",
        } satisfies WebGLGateScrollBehavior;
        gateScroll satisfies WebGLScrollBehavior;
	        const lifecycle = {
	          hideWhenReady: true,
	          hideMode: "subtree",
	        } satisfies WebGLLifecycleDeclaration;
        const material = {
          kind: "solid",
          color: 0x111827,
          opacity: 0.82,
        } satisfies WebGLMaterialDeclaration;
        const solidMaterial = material satisfies WebGLSolidMaterialDeclaration;
        const surfaceMaterial = {
          kind: "surface",
          color: 0x111827,
          opacity: 0.86,
          radius: 18,
        } satisfies WebGLSurfaceMaterialDeclaration;
        surfaceMaterial satisfies WebGLMaterialDeclaration;
	        const motion = {
	          kind: "pointer-tilt",
	          strength: 0.6,
	          maxDegrees: 8,
	        } satisfies WebGLMotionDeclaration;
		        const effects = {
		          material,
		          motion,
		        } satisfies WebGLEffectsDeclaration;
		        const arrayEffects = [
		          { kind: "app.surface", opacity: 0.86 },
		          { kind: "app.pointerTilt", strength: 0.6, maxDegrees: 8 },
		        ] satisfies WebGLEffectsDeclaration;
		        const customEffects = [
		          { kind: "custom.surfacePulse", opacity: 0.4 },
		        ] satisfies WebGLEffectsDeclaration;
		        arrayEffects satisfies WebGLEffectsDeclaration;
		        customEffects satisfies WebGLEffectsDeclaration;
			        const customModelEffect = defineWebGLEffect({
			          kind: "custom.glbParticles",
			          source: "model/glb",
			          setup(ctx, params: { kind: "custom.glbParticles"; density?: number }) {
			            ctx.source satisfies WebGLEffectSourceHandle;
			            ctx.target satisfies WebGLEffectTargetHandle | undefined;
			            ctx.resources satisfies WebGLEffectResourceScope;
			            if (ctx.source.kind === "model/glb") {
			              ctx.source.model.createPointCloud({
			                density: params.density,
			                color: "rgb(125, 211, 252)",
			                size: 0.026,
			              });
			            }
			            return {
			              density: params.density ?? 0.5,
			              scrollAtSetup: ctx.scrollProgress,
			            };
			          },
			          update(ctx, state) {
			            ctx satisfies WebGLEffectContext;
			            state.density satisfies number;
			            ctx.target?.setRotation(0, ctx.pointer.normalizedX);
			          },
			        }) satisfies WebGLEffectDefinition<
			          { kind: "custom.glbParticles"; density?: number },
			          { density: number; scrollAtSetup: number }
			        >;

		        const declaration = {
	          key: "hero.model",
	          source: modelSource,
	          renderRole,
	          scroll: pageScroll,
	          pointer: pointerDeclaration,
		          lifecycle,
		          effects,
		        } satisfies WebGLDeclaration;
		        const arrayEffectDeclaration = {
		          key: "hero.array-effects",
		          effects: arrayEffects,
		        } satisfies WebGLDeclaration;
	        const gateDeclaration = {
          key: "hero.scene",
          scroll: gateScroll,
        } satisfies WebGLDeclaration;

	        declare const runtime: WebGLRuntime;
	        declare const element: HTMLElement;
	        const registeredTarget = runtime.registerTarget(element, declaration);
		        const runtimeOptions = {
		          container: element,
		          effects: [customModelEffect],
		        } satisfies WebGLRuntimeOptions;
		        const customRuntime = createWebGLRuntime(runtimeOptions);
		        customRuntime.registerTarget(element, {
		          key: "product.model",
		          source: { kind: "model", format: "glb", src: "/product.glb" },
		          effects: [{ kind: "custom.glbParticles", density: 0.6 }],
		        });
		        customRuntime.registerTarget(element, arrayEffectDeclaration);
	        registeredTarget satisfies void;
        // @ts-expect-error public registration does not expose internal target descriptor state.
        registeredTarget.scanOrder;
        // @ts-expect-error public registration does not expose internal target descriptor DOM references.
        registeredTarget.element;

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
        const gateFrame = {
          time: 20,
          delta: 10,
          scroll: {
            mode: "gate",
            sceneProgress: 0.25,
            activeGateKey: gateDeclaration.key,
            direction: 1,
            velocity: 0.1,
          },
          pointer,
        } satisfies WebGLFrameInput;
        ({
          time: 30,
          delta: 10,
          scroll: {
            mode: "gate",
            sceneProgress: 0.5,
            activeGateKey: gateDeclaration.key,
            // @ts-expect-error gate frame input is scene-based and does not expose pageProgress.
            pageProgress: 0.25,
            direction: 1,
            velocity: 0.1,
          },
          pointer,
        } satisfies WebGLFrameInput);
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
              lifecycleState: "declared",
              visible: true,
            },
          ],
        } satisfies WebGLDebugState;
        const gateDebugState = {
          targetCount: 1,
          renderableCount: 1,
          currentScrollMode: "gate",
          sceneProgress: gateFrame.scroll.sceneProgress,
          activeGateKey: gateFrame.scroll.activeGateKey,
          pointer: gateFrame.pointer,
          targets: debugState.targets,
        } satisfies WebGLDebugState;

        debugState.targets[0]?.key satisfies string | undefined;
        gateDebugState.sceneProgress satisfies number | undefined;

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
