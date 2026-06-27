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
		        declare const progressSignals: WebGLRuntimeProps["progressSignals"];

		        const runtimeElement = (
		          <WebGLRuntime effects={effects} progressSignals={progressSignals}>
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
		    effects: [{ kind: "custom.reactEffect" }],
		  },
		} satisfies WebGLTargetProps;

		const legacyProps = {
		  webgl: {
		    key: "hero.legacy-effects",
		    effects: {
		      material: { kind: "solid" as const, color: 0x111827, opacity: 0.82 },
		      motion: { kind: "pointer-tilt" as const, strength: 0.6, maxDegrees: 8 },
		    },
		  },
		};
		// @ts-expect-error legacy object-form effects are no longer public contract.
		legacyProps satisfies WebGLTargetProps;
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
				          WebGLEffectCanvasDrawer,
				          WebGLEffectCanvasSurfaceHandle,
				          WebGLEffectContext,
				          WebGLEffectDefinition,
				          WebGLEffectImageSequenceLayerHandle,
				          WebGLEffectBlendMode,
				          WebGLEffectMaterialLayerHandle,
				          WebGLEffectMaterialLayerHost,
				          WebGLEffectMaterialProgram,
				          WebGLEffectPointLayerOptions,
				          WebGLEffectPostprocessHandle,
				          WebGLEffectPostprocessRequest,
				          WebGLEffectRenderableHandle,
				          WebGLEffectResourceScope,
				          WebGLEffectContentBoxShaderInput,
				          WebGLEffectMediaShaderInputs,
				          WebGLEffectObjectFitShaderInput,
				          WebGLEffectSourceTextureShaderInput,
				          WebGLEffectSourceHandle,
				          WebGLEffectSurfaceShaderInputs,
				          WebGLEffectTargetHandle,
				          WebGLEffectTextLayerHandle,
				          WebGLEffectTextShaderInputs,
				          WebGLEffectTextureUniform,
				          WebGLEffectTextureLayerHandle,
				          WebGLEffectTextureTransform,
				          WebGLEffectUniformValue,
				          WebGLEffectVisualContext,
				          WebGLEffectVideoLayerHandle,
				          WebGLModelMeshHandle,
				          WebGLEffectsDeclaration,
			          WebGLFrameInput,
			          WebGLGateScrollBehavior,
	          WebGLLifecycleDeclaration,
	          WebGLOffscreenLifecycleDeclaration,
	          WebGLOffscreenStrategy,
		          WebGLDOMSourceDeclaration,
		          WebGLMediaImageSequenceSourceDeclaration,
		          WebGLMediaImageSourceDeclaration,
		          WebGLMediaSourceDeclaration,
		          WebGLMediaVideoPlaybackDeclaration,
		          WebGLMediaVideoSourceDeclaration,
		          WebGLModelSourceDeclaration,
	          WebGLPointerDeclaration,
	          WebGLPointerState,
	          WebGLProgressSignalSource,
	          WebGLRenderRole,
          WebGLResourceStatus,
          WebGLRuntime,
          WebGLRuntimeOptions,
          WebGLScrollAdapter,
          WebGLScrollBehavior,
          WebGLScrollDeltaRouter,
          WebGLScrollGateState,
          WebGLScrollMetrics,
		          WebGLSourceDeclaration,
	          WebGLTextGlyph,
	          WebGLTextGlyphRenderCommand,
	          WebGLTextLayerStyle,
		        } from "${importPath}";

        // @ts-expect-error legacy material declarations are no longer public exports.
        import type { WebGLMaterialDeclaration } from "${importPath}";
        // @ts-expect-error legacy motion declarations are no longer public exports.
        import type { WebGLMotionDeclaration } from "${importPath}";
        // @ts-expect-error legacy solid material declarations are no longer public exports.
        import type { WebGLSolidMaterialDeclaration } from "${importPath}";
        // @ts-expect-error legacy surface material declarations are no longer public exports.
        import type { WebGLSurfaceMaterialDeclaration } from "${importPath}";

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
	        // @ts-expect-error Three renderer is internal runtime state.
	        import type { WebGLRenderer } from "${importPath}";
	        // @ts-expect-error Three scene is internal runtime state.
	        import type { Scene } from "${importPath}";
	        // @ts-expect-error Three camera is internal runtime state.
	        import type { Camera } from "${importPath}";
	        // @ts-expect-error EffectComposer is internal postprocess state.
	        import type { EffectComposer } from "${importPath}";
	        // @ts-expect-error WebGLRenderTarget is internal postprocess state.
	        import type { WebGLRenderTarget } from "${importPath}";

        createWebGLRuntime satisfies (
          options: WebGLRuntimeOptions,
        ) => WebGLRuntime;
        const scrollMetrics = {
          scrollY: 120,
          scrollHeight: 2000,
          viewportHeight: 800,
        } satisfies WebGLScrollMetrics;
        const routeDelta = ((deltaY: number) => deltaY !== 0) satisfies WebGLScrollDeltaRouter;
        const scrollAdapter = {
          kind: "test.scroll",
          readMetrics: () => scrollMetrics,
          connectDeltaRouter(router) {
            routeDelta(1);
            router(1);
            return () => {};
          },
          subscribe(listener) {
            listener();
            return () => {};
          },
          onGateStateChange(state) {
            state satisfies WebGLScrollGateState;
          },
          dispose() {},
        } satisfies WebGLScrollAdapter;
        const progressSignals = {
          get(key) {
            return key === "section.reveal" ? 0.5 : 0;
          },
        } satisfies WebGLProgressSignalSource;
        const runtimeOptionsWithScrollAdapter = {
          container: document.createElement("div"),
          scrollAdapter,
          progressSignals,
        } satisfies WebGLRuntimeOptions;
        runtimeOptionsWithScrollAdapter satisfies WebGLRuntimeOptions;

        const renderRole = "model" satisfies WebGLRenderRole;
	        const domSource = {
	          kind: "dom",
	          type: "text",
	        } satisfies WebGLDOMSourceDeclaration;
		        const imageSource = {
		          kind: "media",
		          type: "image",
		          src: "/textures/card.png",
		        } satisfies WebGLMediaImageSourceDeclaration;
		        declare const imageSequenceFrames: readonly HTMLImageElement[];
		        const imageSequenceSource = {
		          kind: "media",
		          type: "image-sequence",
		          frameCount: 454,
		          frames: imageSequenceFrames,
		          progressKey: "example.video.scrub",
		        } satisfies WebGLMediaImageSequenceSourceDeclaration;
		        const playback = {
		          muted: true,
		          loop: true,
		          autoplay: true,
		          playsInline: true,
		          playbackRate: 1,
		          visibility: "pause-resume",
		        } satisfies WebGLMediaVideoPlaybackDeclaration;
	        const videoSource = {
	          kind: "media",
	          type: "video",
	          src: "/media/loop.mp4",
	          playback,
	        } satisfies WebGLMediaVideoSourceDeclaration;
	        const modelSource = {
	          kind: "model",
	          type: "glb",
	          src: "/models/hero.glb",
	        } satisfies WebGLModelSourceDeclaration;
	        const mediaSource = videoSource satisfies WebGLMediaSourceDeclaration;

	        domSource satisfies WebGLSourceDeclaration;
	        imageSource satisfies WebGLSourceDeclaration;
	        imageSequenceSource satisfies WebGLSourceDeclaration;
	        videoSource satisfies WebGLSourceDeclaration;
	        modelSource satisfies WebGLSourceDeclaration;
	        mediaSource satisfies WebGLMediaSourceDeclaration;
	        const declarations = [
	          { key: "surface", source: { kind: "dom", type: "element" } },
	          { key: "text", source: { kind: "dom", type: "text" } },
	          { key: "image", source: { kind: "media", type: "image", src: "/image.png" } },
	          { key: "video", source: { kind: "media", type: "video", src: "/video.mp4" } },
	          {
	            key: "sequence",
	            source: {
	              kind: "media",
	              type: "image-sequence",
	              frameCount: 1,
	              frames: [document.createElement("canvas")],
	            },
	          },
	          { key: "model", source: { kind: "model", type: "glb", src: "/product.glb" } },
	        ] satisfies WebGLDeclaration[];
	        declarations satisfies WebGLDeclaration[];

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
        const offscreenStrategy: WebGLOffscreenStrategy = "restore-dom";
        const offscreenLifecycle: WebGLOffscreenLifecycleDeclaration = {
          strategy: offscreenStrategy,
        };
        const lifecycle = {
          hideWhenReady: true,
          hideMode: "subtree",
        } satisfies WebGLLifecycleDeclaration;
        const lifecycleWithOffscreen = {
          ...lifecycle,
          offscreen: offscreenLifecycle,
        };
			        const arrayEffects = [
			          { kind: "app.surface", opacity: 0.86 },
			          { kind: "app.pointerTilt", strength: 0.6, maxDegrees: 8 },
			        ] satisfies WebGLEffectsDeclaration;
			        const customEffects = [
			          { kind: "custom.surfacePulse", opacity: 0.4 },
			        ] satisfies WebGLEffectsDeclaration;
			        const legacyEffects = {
			          material: { kind: "solid" as const, color: 0x111827, opacity: 0.82 },
			          motion: { kind: "pointer-tilt" as const, strength: 0.6, maxDegrees: 8 },
			        };
			        // @ts-expect-error legacy object-form effects are no longer public contract.
			        legacyEffects satisfies WebGLEffectsDeclaration;
			        arrayEffects satisfies WebGLEffectsDeclaration;
			        customEffects satisfies WebGLEffectsDeclaration;
				        const customModelEffect = defineWebGLEffect({
				          kind: "custom.glbParticles",
				          source: "model/glb",
				          setup(ctx, params: { kind: "custom.glbParticles"; density?: number }) {
				            ctx.source satisfies WebGLEffectSourceHandle;
				            ctx.target satisfies WebGLEffectTargetHandle | undefined;
				            ctx.resources satisfies WebGLEffectResourceScope;
				            ctx.visual satisfies WebGLEffectVisualContext;
				            const postprocess = ctx.visual.requestPostprocess({
				              key: "custom.glow",
				              bloom: { strength: 0.6, radius: 0.2, threshold: 0.8 },
				              grain: { amount: 0.05 },
				              blur: { radius: 0.25 },
				            } satisfies WebGLEffectPostprocessRequest);
				            postprocess satisfies WebGLEffectPostprocessHandle;
				            if (ctx.source.kind === "model" && ctx.source.type === "glb") {
				              ctx.source.model.createPointCloud({
				                density: params.density,
				                color: "rgb(125, 211, 252)",
				                size: 0.026,
				              });
				              ctx.source.model.createPointLayer({
				                positions: new Float32Array([0, 0, 0]),
				                color: "#7dd3fc",
				                size: 0.026,
				                material: {
				                  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
				                  uniforms: {
				                    sourceMap: { kind: "source-texture" },
				                  },
				                },
				              } satisfies WebGLEffectPointLayerOptions);
				              ctx.source.model.forEachMesh((mesh) => {
				                mesh satisfies WebGLModelMeshHandle;
				                mesh.index satisfies number;
				                mesh.name satisfies string | undefined;
				                mesh.materialName satisfies string | undefined;
				                mesh.createMaterialLayer({
				                  key: "custom.mesh",
				                  mode: "replace-source",
				                  sourceTextureUniform: "sourceMap",
				                  program: {
				                    fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
				                    blend: "normal" satisfies WebGLEffectBlendMode,
				                  },
				                }).clear();
				                mesh.restoreMaterial();
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
			            ctx.progress.get("section.reveal") satisfies number;
			            ctx.target?.setPosition(0, 0, 0);
			            ctx.target?.setRotation(0, ctx.pointer.normalizedX);
			          },
			        }) satisfies WebGLEffectDefinition<
			          { kind: "custom.glbParticles"; density?: number },
			          { density: number; scrollAtSetup: number }
			        >;

        const sourceCapabilityEffect = defineWebGLEffect({
          kind: "custom.sourceCapabilities",
          update(ctx) {
	            if (ctx.source.kind === "dom" && ctx.source.type === "element") {
	              ctx.source.surface satisfies WebGLEffectCanvasSurfaceHandle | undefined;
	              ctx.source.surface?.shaderInputs satisfies WebGLEffectSurfaceShaderInputs | undefined;
	              ctx.source.surface?.shaderInputs.size.width satisfies number | undefined;
	              ctx.source.surface?.shaderInputs.sourceTexture satisfies
	                | WebGLEffectSourceTextureShaderInput
	                | undefined;
	              ctx.source.surface?.shaderInputs.contentBox satisfies
	                | WebGLEffectContentBoxShaderInput
	                | undefined;
	              ctx.source.surface?.draw(({ context }) => {
	                context.fillRect(0, 0, 10, 10);
	              });
	              const layer = ctx.source.surface?.createMaterialLayer({
	                key: "custom.surfaceShader",
	                sourceTextureUniform: "sourceMap",
	                mode: "replace-source",
	                program: {
	                  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
	                  uniforms: {
	                    strength: 0.5,
	                    enabled: true,
	                    label: "surface",
	                    uvScale: [1, 1],
	                    tint: [1, 1, 1],
	                    color: [1, 1, 1, 1],
	                    sourceMap: { kind: "source-texture" },
	                  },
	                  defines: { USE_SOURCE: true },
	                  blend: "screen",
	                  transparent: true,
	                  depthWrite: false,
	                  depthTest: true,
	                  toneMapped: false,
	                } satisfies WebGLEffectMaterialProgram,
	              });
	              layer satisfies WebGLEffectMaterialLayerHandle | undefined;
	            }

	            if (ctx.source.kind === "dom" && ctx.source.type === "text") {
	              ctx.source.textLayer satisfies WebGLEffectTextLayerHandle | undefined;
	              ctx.source.textLayer?.shaderInputs satisfies
	                | WebGLEffectTextShaderInputs
	                | undefined;
	              ctx.source.textLayer?.shaderInputs.glyphs satisfies
	                | readonly WebGLTextGlyph[]
	                | undefined;
	              const glyphs = ctx.source.textLayer?.getGlyphs() ?? [];
              glyphs satisfies readonly WebGLTextGlyph[];
              ctx.source.textLayer?.setGlyphs((entries) =>
                entries.map((glyph) => ({
                  index: glyph.index,
                  char: glyph.char,
                  scaleX: 1,
                  scaleY: 1,
	                  opacity: 1,
	                })),
	              );
	              ctx.source.textLayer satisfies WebGLEffectMaterialLayerHost | undefined;
	            }

	            if (ctx.source.kind === "media" && ctx.source.type === "image") {
	              ctx.source.image satisfies
	                | WebGLEffectTextureLayerHandle<HTMLImageElement>
	                | undefined;
	              ctx.source.image?.shaderInputs satisfies
	                | WebGLEffectMediaShaderInputs
	                | undefined;
	              ctx.source.image?.shaderInputs.naturalSize.width satisfies
	                | number
	                | undefined;
	              ctx.source.image?.shaderInputs.uvTransform satisfies
	                | WebGLEffectObjectFitShaderInput
	                | undefined;
	              const imageLayer = ctx.source.image;
	              imageLayer?.setTextureTransform({ repeatX: 1, repeatY: 1 });
	              imageLayer?.createMaterialLayer({
	                key: "custom.imageShader",
	                program: {
	                  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
	                  uniforms: {
	                    imageMap: {
	                      kind: "image-texture",
	                      source: imageLayer.source,
	                    } satisfies WebGLEffectTextureUniform,
	                  },
	                },
	              });
	            }

	            if (ctx.source.kind === "media" && ctx.source.type === "video") {
	              ctx.source.video satisfies WebGLEffectVideoLayerHandle | undefined;
	              ctx.source.video?.shaderInputs satisfies
	                | WebGLEffectMediaShaderInputs
	                | undefined;
	              const videoLayer = ctx.source.video;
	              videoLayer?.setMuted(true);
	              videoLayer?.setPlaybackRate(1);
	              videoLayer?.createMaterialLayer({
	                key: "custom.videoShader",
	                program: {
	                  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
	                  uniforms: {
	                    videoMap: {
	                      kind: "video-texture",
	                      source: videoLayer.source,
	                    },
	                  },
	                },
	              });
	            }

		            if (ctx.source.kind === "media" && ctx.source.type === "image-sequence") {
		              ctx.source.image satisfies
		                | WebGLEffectImageSequenceLayerHandle
		                | undefined;
		              ctx.source.frame satisfies number;
		              ctx.source.src satisfies string;
	              ctx.source.image?.setTextureTransform({ repeatX: 1, repeatY: 1 });
	            }

            if (ctx.source.kind === "model" && ctx.source.type === "glb") {
              ctx.source.model satisfies WebGLEffectRenderableHandle;
              ctx.source.model.sampleVertices({ maxPoints: 64 });
            }
          },
        });

        sourceCapabilityEffect satisfies WebGLEffectDefinition;
	        ({ repeatX: 1, offsetY: 0 }) satisfies WebGLEffectTextureTransform;
	        ({ kind: "canvas-texture", source: document.createElement("canvas") }) satisfies WebGLEffectUniformValue;
	        ({ index: 0, char: "A" }) satisfies WebGLTextGlyphRenderCommand;
        declare const drawer: WebGLEffectCanvasDrawer;
        drawer satisfies WebGLEffectCanvasDrawer;
        declare const style: WebGLTextLayerStyle;
        style.font satisfies string;

	        const declaration = {
	          key: "hero.model",
	          source: modelSource,
	          renderRole,
			          scroll: pageScroll,
			          pointer: pointerDeclaration,
			          lifecycle: lifecycleWithOffscreen,
			          effects: arrayEffects,
			        } satisfies WebGLDeclaration;
			        const legacyEffectDeclaration = {
			          key: "hero.legacy-effects",
			          effects: legacyEffects,
			        };
			        // @ts-expect-error legacy object-form effects are no longer public contract.
			        legacyEffectDeclaration satisfies WebGLDeclaration;
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
		          progressSignals,
		        } satisfies WebGLRuntimeOptions;
			        const customRuntime = createWebGLRuntime(runtimeOptions);
			        customRuntime.registerTarget(element, {
			          key: "product.model",
			          source: { kind: "model", type: "glb", src: "/product.glb" },
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
              sourceKind: "model/glb",
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
