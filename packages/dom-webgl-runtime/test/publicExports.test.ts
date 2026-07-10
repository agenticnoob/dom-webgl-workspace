import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

import {
  getFixtureDiagnostics,
  withTypecheckLock,
} from "./helpers/typecheck";

const TYPECHECK_TEST_TIMEOUT_MS = 180_000;

describe("public package exports", () => {
  test("root entrypoint exposes runtime APIs without internal helpers", async () => {
    const rootApi = await import("@viselora/dom-webgl");

    expect(rootApi.createWebGLRuntime).toEqual(expect.any(Function));
    expect(rootApi.defineWebGLEffect).toEqual(expect.any(Function));
    expect(rootApi.defineWebGLSceneObjectEffect).toEqual(expect.any(Function));
    expect(rootApi).not.toHaveProperty("pointerTiltEffect");
    expect(rootApi).not.toHaveProperty("surfaceBasicEffect");
    expect(rootApi).not.toHaveProperty("createWebGLEffectRegistry");
    expect(rootApi).not.toHaveProperty("createTargetRegistry");
  });

  test("React entrypoint exposes the public React adapter", async () => {
    const reactApi = await import("@viselora/dom-webgl/react");

    expect(reactApi.WebGLRuntime).toEqual(expect.any(Function));
    expect(reactApi.WebGLTarget).toEqual(expect.any(Function));
    expect(reactApi.WebGLScene).toEqual(expect.any(Function));
    expect(reactApi.WebGLCamera).toEqual(expect.any(Function));
    expect(reactApi.WebGLRenderPass).toEqual(expect.any(Function));
    expect(reactApi.WebGLPassViewport).toEqual(expect.any(Function));
    expect(reactApi.WebGLStagePlane).toEqual(expect.any(Function));
    expect(reactApi.WebGLStageBox).toEqual(expect.any(Function));
    expect(reactApi.WebGLLight).toEqual(expect.any(Function));
    expect(reactApi.WebGLModel).toEqual(expect.any(Function));
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

  test("React entrypoint type-checks public gate declarations only", async () => {
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
        import {
          WebGLCamera,
          WebGLLight,
          WebGLPassViewport,
          WebGLRenderPass,
          WebGLRuntime,
          WebGLScene,
          WebGLStageBox,
          WebGLStagePlane,
          WebGLModel,
          WebGLTarget,
        } from "${importPath}";
        import type {
          WebGLCameraProps,
          WebGLLightProps,
          WebGLPassViewportProps,
          WebGLRenderPassProps,
          WebGLRuntimeProps,
          WebGLSceneProps,
          WebGLSceneRenderOptions,
          WebGLStageBoxProps,
          WebGLStagePlaneProps,
          WebGLModelProps,
          WebGLTargetProps,
        } from "${importPath}";
        import type { ReactElement } from "react";
        import type { Camera as ThreeCamera } from "three/src/cameras/Camera.js";
        import type { Light as ThreeLight } from "three/src/lights/Light.js";
        import type { Material as ThreeMaterial } from "three/src/materials/Material.js";
        import type { Mesh as ThreeMesh } from "three/src/objects/Mesh.js";
        import type { Scene as ThreeScene } from "three/src/scenes/Scene.js";
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
        // @ts-expect-error Render layer registry is internal runtime state.
        import type { InternalRenderLayerRegistry } from "${importPath}";
        // @ts-expect-error Internal render scenes are not public declarations.
        import type { InternalRenderSceneEntry } from "${importPath}";
        // @ts-expect-error Internal render cameras are not public declarations.
        import type { InternalRenderCameraEntry } from "${importPath}";
        // @ts-expect-error Internal render passes are not public declarations.
        import type { InternalRenderPassEntry } from "${importPath}";
        WebGLRuntime satisfies unknown;
        WebGLTarget satisfies unknown;
        WebGLScene satisfies unknown;
        WebGLCamera satisfies unknown;
        WebGLPassViewport satisfies unknown;
        WebGLRenderPass satisfies unknown;
        WebGLStagePlane satisfies unknown;
        WebGLStageBox satisfies unknown;
        WebGLLight satisfies unknown;
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

        const levelTwoElement = (
          <WebGLRuntime effects={effects} progressSignals={progressSignals}>
            <WebGLTarget
              webgl={{
                key: "level1.title",
                source: { kind: "dom", type: "text" },
              }}
            >
              Level 1 still works
            </WebGLTarget>

            <WebGLScene id="world" render={{ camera: "world.camera" }}>
              <WebGLCamera id="world.camera" default />
              <WebGLTarget
                webgl={{
                  key: "world.model",
                  source: { kind: "model", type: "glb", src: "/models/hero.glb" },
                }}
              >
                <div />
              </WebGLTarget>
            </WebGLScene>

            <WebGLPassViewport id="world.stage.viewport" as="section">
              <WebGLScene
                id="world.stage"
                projection="perspective-stage"
                render={{
                  camera: "world.stage.camera",
                  clearDepth: true,
                  viewport: { mode: "dom-rect" },
                  postprocess: { grain: { amount: 0.04 } },
                }}
              >
                <WebGLCamera
                  id="world.stage.camera"
                  default
                  type="perspective"
                  mode="perspective-stage"
                  position={[0, 0, 500]}
                  target={[0, 0, 0]}
                />
                <WebGLStagePlane
                  id="stage.floor"
                  role="floor"
                  size={[1200, 800]}
                  material={{ kind: "standard", color: "#05070a", roughness: 0.8 }}
                />
                <WebGLStageBox
                  id="stage.box"
                  size={[120, 80, 120]}
                  position={[0, -40, 0]}
                  material={{ kind: "basic", color: "#ffffff", opacity: 0.5 }}
                />
                <WebGLLight id="stage.ambient" kind="ambient" intensity={0.2} />
                <WebGLLight
                  id="stage.hero"
                  kind="point"
                  color="#7dd3fc"
                  intensity={1.8}
                  position={[0, 0, 160]}
                />
                <WebGLModel
                  id="stage.character"
                  src="/models/Sprint.glb"
                  position={[0, -120, 0]}
                  scale={[120, 120, 120]}
                  animation={{
                    defaultClip: { clip: "MainSkeleton.001", loop: "repeat" },
                    blend: {
                      from: "MainSkeleton.001",
                      to: "Walk",
                      timeline: "hero.timeline",
                      fadeMs: 180,
                    },
                  }}
                />
              </WebGLScene>
            </WebGLPassViewport>

            <WebGLScene
              id="world.stage.legacy"
              projection="perspective-stage"
              render={{ camera: "world.stage.legacy.camera", clearDepth: true }}
            >
              <WebGLCamera
                id="world.stage.legacy.camera"
                default
                type="perspective"
                mode="perspective-stage"
                position={[0, 0, 500]}
                target={[0, 0, 0]}
              />
              <WebGLStagePlane
                id="stage.floor"
                role="floor"
                size={[1200, 800]}
                material={{ kind: "standard", color: "#05070a", roughness: 0.8 }}
              />
              <WebGLStageBox
                id="stage.box"
                size={[120, 80, 120]}
                position={[0, -40, 0]}
                material={{ kind: "basic", color: "#ffffff", opacity: 0.5 }}
              />
              <WebGLLight id="stage.ambient" kind="ambient" intensity={0.2} />
              <WebGLLight
                id="stage.hero"
                kind="point"
                color="#7dd3fc"
                intensity={1.8}
                position={[0, 0, 160]}
              />
            </WebGLScene>

            <WebGLScene id="overlay" render={{ camera: "overlay.camera", order: 1 }}>
              <WebGLCamera id="overlay.camera" default />
              <WebGLTarget
                webgl={{
                  key: "overlay.title",
                  source: { kind: "dom", type: "text" },
                }}
              >
                Overlay title
              </WebGLTarget>
            </WebGLScene>
          </WebGLRuntime>
        );

        levelTwoElement satisfies ReactElement;

        // Stable scene declarations keep descriptor identity stable across renders.
        const stableStageMaterial = {
          kind: "standard",
          color: "#05070a",
          roughness: 0.8,
        } satisfies WebGLStagePlaneProps["material"];

        const stableStagePlane = (
          <WebGLStagePlane
            id="stable.floor"
            scene="world.stage"
            role="floor"
            material={stableStageMaterial}
          />
        );

        stableStagePlane satisfies unknown;

        const sceneRender = {
          camera: "world.camera",
          order: 0,
        } satisfies WebGLSceneRenderOptions;
        sceneRender satisfies WebGLSceneRenderOptions;

        const sceneProps = {
          id: "world",
          render: sceneRender,
        } satisfies WebGLSceneProps;
        sceneProps satisfies WebGLSceneProps;

        const legacyDefaultPassSceneProps = {
          id: "legacy",
          defaultPass: true,
        } satisfies WebGLSceneProps;
        legacyDefaultPassSceneProps satisfies WebGLSceneProps;

        const cameraProps = {
          id: "world.camera",
          default: true,
          type: "orthographic",
          mode: "dom-aligned",
        } satisfies WebGLCameraProps;
        cameraProps satisfies WebGLCameraProps;

        const cameraWithControllerProps = {
          id: "hero.camera",
          default: true,
          type: "perspective",
          mode: "perspective-stage",
          position: [0, 0, 700],
          target: [0, 0, 0],
          fov: 44,
          controller: {
            timeline: {
              id: "hero.timeline",
              range: { from: 0.1, to: 0.9 },
            },
            to: {
              position: [0, 120, 520],
              target: [0, 48, 0],
              fov: 34,
            },
            easing: "smoothstep",
          },
        } satisfies WebGLCameraProps;
        cameraWithControllerProps satisfies WebGLCameraProps;

        const cameraWithGestureControllerProps = {
          id: "stage.camera",
          default: true,
          type: "perspective",
          mode: "perspective-stage",
          controller: {
            pointer: {
              orbit: {
                target: [0, 0, 0],
                minDistance: 240,
                maxDistance: 980,
              },
              pan: true,
              dolly: { drag: { button: "primary", modifier: "alt" } },
              parallax: { scope: "camera", strength: [16, 8] },
              damping: { factor: 0.18 },
              reset: { onDoubleClick: true },
            },
          },
        } satisfies WebGLCameraProps;
        cameraWithGestureControllerProps satisfies WebGLCameraProps;

        const invalidParallaxControllerProps = {
          id: "stage.camera.invalid",
          controller: {
            pointer: {
              parallax: { scope: "scene-layer" },
            },
          },
        };
        // @ts-expect-error Scene-layer parallax is not a Phase 8B v1 public scope.
        invalidParallaxControllerProps satisfies WebGLCameraProps;

        const cameraTimelineProps = {
          id: "hero.camera",
          // @ts-expect-error WebGLCamera does not accept top-level timeline behavior.
          timeline: "hero.timeline",
        } satisfies WebGLCameraProps;
        cameraTimelineProps satisfies WebGLCameraProps;

        const passBoundControllerProps = {
          id: "hero.camera",
          controller: {
            timeline: "hero.timeline",
            // @ts-expect-error Camera controllers do not accept pass-bound public scope in v1.
            pass: "hero.pass",
            to: { fov: 34 },
          },
        } satisfies WebGLCameraProps;
        passBoundControllerProps satisfies WebGLCameraProps;

        const passProps = {
          id: "world.pass",
          scene: "world",
          camera: "world.camera",
          order: 0,
          viewport: { mode: "dom-rect", anchorId: "world.viewport", scissor: true },
          postprocess: { grain: { amount: 0.04 } },
        } satisfies WebGLRenderPassProps;
        passProps satisfies WebGLRenderPassProps;
        const passViewportProps = {
          id: "world.viewport",
          as: "section",
        } satisfies WebGLPassViewportProps<"section">;
        passViewportProps satisfies WebGLPassViewportProps<"section">;
        const modelProps = {
          id: "character",
          src: "/models/Sprint.glb",
          position: [0, -120, 0],
          scale: [120, 120, 120],
          animation: {
            defaultClip: { clip: "MainSkeleton.001", loop: "repeat" },
            defaultClips: [
              { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
              { clip: "SpeedLines.001", loop: "repeat" },
              "BagArmature.001",
            ],
          },
        } satisfies WebGLModelProps;
        modelProps satisfies WebGLModelProps;
        const modelWithExplicitSceneProps = {
          id: "character.explicit",
          scene: "world.stage",
          src: "/models/Sprint.glb",
        } satisfies WebGLModelProps;
        modelWithExplicitSceneProps satisfies WebGLModelProps;
        const modelEffectsProps = {
          id: "character.effects",
          src: "/models/Sprint.glb",
          interaction: {
            pickable: {
              hitTest: "mesh",
              pointer: { hover: true, press: true, click: true, drag: true },
            },
          },
          effects: [{ kind: "app.modelEffect" }],
        } satisfies WebGLModelProps;
        modelEffectsProps satisfies WebGLModelProps;
        const rawRaycastInteraction: WebGLModelProps["interaction"] = {
          // @ts-expect-error pickable does not accept raw Three raycaster options.
          raycaster: {},
        };
        const rawRaycastModelProps = {
          id: "raw",
          src: "/m.glb",
          interaction: rawRaycastInteraction,
        } satisfies WebGLModelProps;
        rawRaycastModelProps satisfies WebGLModelProps;

        declare const rawScene: ThreeScene;
        declare const rawCamera: ThreeCamera;
        declare const rawMesh: ThreeMesh;
        declare const rawMaterial: ThreeMaterial;
        declare const rawLight: ThreeLight;

        // @ts-expect-error WebGLScene does not accept a raw Three scene handle.
        const rawSceneProps = { id: "raw", scene: rawScene } satisfies WebGLSceneProps;

        // @ts-expect-error WebGLCamera does not accept a raw Three camera handle.
        const rawCameraProps = { id: "raw.camera", camera: rawCamera } satisfies WebGLCameraProps;

        const rawControllerProps = {
          id: "raw.controller",
          controller: {
            timeline: "hero.timeline",
            // @ts-expect-error Camera controllers do not accept raw Three camera handles.
            camera: rawCamera,
            to: { fov: 34 },
          },
        } satisfies WebGLCameraProps;
        rawControllerProps satisfies WebGLCameraProps;

        // @ts-expect-error Stage planes do not accept raw Three mesh handles.
        const rawMeshPlaneProps = { id: "raw.plane", mesh: rawMesh } satisfies WebGLStagePlaneProps;

        // @ts-expect-error Stage material is a descriptor, not a raw Three material.
        const rawMaterialPlaneProps = { id: "raw.material", material: rawMaterial } satisfies WebGLStagePlaneProps;

        // @ts-expect-error WebGLLight is a descriptor, not a raw Three light wrapper.
        const rawLightProps = { id: "raw.light", light: rawLight } satisfies WebGLLightProps;

        const updateCallbackPlaneProps = {
          id: "raw.update",
          // @ts-expect-error Stage components do not expose an imperative update callback.
          onUpdate() {},
        } satisfies WebGLStagePlaneProps;

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

        return getFixtureDiagnostics(program, fixturePath);
      });

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

  test("root entrypoint type-checks public types and hides internal types", async () => {
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
			          defineWebGLSceneObjectEffect,
			        } from "${importPath}";
				        import type {
                  WebGLCameraDeclaration,
                  WebGLCameraControllerDeclaration,
                  WebGLCameraControllerEasing,
                  WebGLCameraControllerFrameDeclaration,
                  WebGLCameraControllerTimelineDeclaration,
                  WebGLCameraFramingDeclaration,
                  WebGLCameraMode,
                  WebGLCameraType,
                  WebGLColorValue,
                  WebGLDebugModelDiagnostic,
                  WebGLDebugModelPrepareSummary,
                  WebGLDebugModelSummary,
					          WebGLDebugState,
					          WebGLDeclaration,
                  WebGLEffectAmbientLightRequest,
                  WebGLEffectAnimationFacade,
                  WebGLEffectAnimationBlendOptions,
                  WebGLEffectAnimationCrossfadeOptions,
                  WebGLEffectAnimationPlayOptions,
                  WebGLEffectAnimationScrubOptions,
                  WebGLEffectCanvasDrawer,
				          WebGLEffectCanvasSurfaceHandle,
				          WebGLEffectContext,
				          WebGLEffectDefinition,
				          WebGLEffectColorLike,
				          WebGLEffectColorValue,
				          WebGLEffectDirectionalLightRequest,
				          WebGLEffectEmissiveLike,
				          WebGLEffectImageSequenceLayerHandle,
				          WebGLEffectBlendMode,
				          WebGLEffectLightFollowMode,
				          WebGLEffectLightsFacade,
				          WebGLEffectMaterialFacade,
				          WebGLEffectMaterialLayerHandle,
				          WebGLEffectMaterialLayerHost,
				          WebGLEffectMaterialLayerOptions,
				          WebGLEffectMaterialProgram,
				          WebGLEffectPointLayerOptions,
				          WebGLEffectPointLightRequest,
				          WebGLEffectPostprocessHandle,
				          WebGLEffectRenderableHandle,
				          WebGLEffectResourceScope,
				          WebGLEffectRuntimePostprocessFacade,
					          WebGLEffectRuntimeScope,
					          WebGLEffectSchedule,
					          WebGLEffectSceneScope,
                    WebGLSceneObjectEffectContext,
                    WebGLSceneObjectEffectDefinition,
                    WebGLSceneObjectEffectSourceKind,
                    WebGLSceneObjectInteractionDeclaration,
                    WebGLSceneObjectPointerState,
					          WebGLEffectContentBoxShaderInput,
					          WebGLEffectMediaShaderInputs,
					          WebGLEffectObjectFitShaderInput,
                      WebGLEffectModelFacade,
                      WebGLEffectModelMeshesFacade,
                      WebGLEffectModelMorphsFacade,
                      WebGLEffectModelPointsFacade,
                      WebGLEffectModelRigFacade,
                      WebGLEffectModelSamplingFacade,
                      WebGLEffectObjectHandle,
			          WebGLEffectSourceTextureShaderInput,
			          WebGLEffectScaleLike,
			          WebGLEffectSurfaceShaderInputs,
			          WebGLEffectTextFacade,
			          WebGLEffectTextLayerHandle,
			          WebGLEffectTextShaderInputs,
					          WebGLEffectTextureFacade,
					          WebGLEffectTextureUniform,
						          WebGLEffectTextureLayerHandle,
						          WebGLEffectTextureTransform,
			          WebGLEffectUniformValue,
			          WebGLEffectVector3Like,
			          WebGLEffectVideoFacade,
			          WebGLEffectVideoLayerHandle,
                  WebGLLightDeclaration,
                  WebGLLightKind,
                  WebGLModelEffectHandle,
                  WebGLModelAnimationDeclaration,
                  WebGLModelAnimationLoop,
                  WebGLModelClipBlendDeclaration,
                  WebGLModelClipPlaybackDeclaration,
                  WebGLModelClipScrubDeclaration,
                  WebGLModelDeclaration,
                  WebGLModelMeshHandle,
                  WebGLModelMorphWeightDeclaration,
                  WebGLModelPrepareDeclaration,
                  WebGLEffectsDeclaration,
				          WebGLFrameInput,
				          WebGLGateScrollBehavior,
				          WebGLPerformanceBudget,
				          WebGLPerformanceWarning,
                  WebGLColliderDeclaration,
                  WebGLDebugPhysicsBodySummary,
                  WebGLDebugPhysicsSummary,
                  WebGLPhysicsBodyDeclaration,
                  WebGLPhysicsBodyType,
                  WebGLPhysicsConstraintDeclaration,
                  WebGLPhysicsDeclaration,
                  WebGLPhysicsPointerDragDeclaration,
		          WebGLLifecycleDeclaration,
	          WebGLOffscreenLifecycleDeclaration,
	          WebGLOffscreenStrategy,
		          WebGLPlacementDeclaration,
		          WebGLPlacementMode,
		          WebGLPassViewportDeclaration,
              WebGLPickableDeclaration,
			          WebGLDOMSourceDeclaration,
		          WebGLMediaImageSequenceSourceDeclaration,
		          WebGLMediaImageSourceDeclaration,
		          WebGLMediaSourceDeclaration,
			          WebGLMediaVideoPlaybackDeclaration,
			          WebGLMediaVideoSourceDeclaration,
				          WebGLModelLoaderDeclaration,
				          WebGLModelSourceDeclaration,
              WebGLObjectPointerDeclaration,
		          WebGLPointerDeclaration,
		          WebGLPointerState,
	          WebGLTargetPointerState,
	          WebGLProgressSignalSource,
	          WebGLEffectTimelineScope,
	          WebGLTimelineActiveRangeDeclaration,
	          WebGLTimelineBindingDeclaration,
	          WebGLRenderRole,
	          WebGLRenderPassDeclaration,
	          WebGLPostprocessDeclaration,
	          WebGLPostprocessScopeDeclaration,
	          WebGLResourceStatus,
	          WebGLRuntimePostprocessRequest,
	          WebGLRuntime,
	          WebGLRuntimeOptions,
          WebGLScrollAdapter,
          WebGLScrollBehavior,
          WebGLScrollDeltaRouter,
          WebGLStageBoxDeclaration,
          WebGLStageMaterialDeclaration,
          WebGLStagePlaneDeclaration,
          WebGLStagePlaneRole,
          WebGLStagePrimitiveDeclaration,
          WebGLStagePrimitiveKind,
	          WebGLScrollGateState,
	          WebGLScrollMetrics,
          WebGLTransformScope,
		          WebGLSourceDeclaration,
	          WebGLSceneDeclaration,
	          WebGLSceneProjection,
	          WebGLScreenAnchor,
              WebGLScreenPlanePlacementDeclaration,
	          WebGLTextGlyph,
	          WebGLTextGlyphRenderCommand,
	          WebGLTextLayerStyle,
	          WebGLTuple2,
	          WebGLTuple3,
		        } from "${importPath}";
        type ThreeAnimationAction = { readonly __rawAnimationAction: unique symbol };
        type ThreeAnimationMixer = { readonly __rawAnimationMixer: unique symbol };
        type ThreeObject3D = { readonly __rawObject3D: unique symbol };
        type ThreeBone = { readonly __rawBone: unique symbol };
        type ThreeSkeleton = { readonly __rawSkeleton: unique symbol };

        // @ts-expect-error legacy material declarations are no longer public exports.
        import type { WebGLMaterialDeclaration } from "${importPath}";
        // @ts-expect-error legacy motion declarations are no longer public exports.
        import type { WebGLMotionDeclaration } from "${importPath}";
        // @ts-expect-error legacy solid material declarations are no longer public exports.
        import type { WebGLSolidMaterialDeclaration } from "${importPath}";
        // @ts-expect-error legacy surface material declarations are no longer public exports.
        import type { WebGLSurfaceMaterialDeclaration } from "${importPath}";
        // @ts-expect-error source handles are internal assembly details.
        import type { WebGLEffectSourceHandle } from "${importPath}";
        // @ts-expect-error target handles are internal assembly details.
        import type { WebGLEffectTargetHandle } from "${importPath}";
        // @ts-expect-error visual context is replaced by ctx.runtime.postprocess.
        import type { WebGLEffectVisualContext } from "${importPath}";

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
        // @ts-expect-error Render layer registry is internal runtime state.
        import type { InternalRenderLayerRegistry } from "${importPath}";
        // @ts-expect-error Internal render scenes are not public declarations.
        import type { InternalRenderSceneEntry } from "${importPath}";
        // @ts-expect-error Internal render cameras are not public declarations.
        import type { InternalRenderCameraEntry } from "${importPath}";
        // @ts-expect-error Internal render passes are not public declarations.
        import type { InternalRenderPassEntry } from "${importPath}";
        // @ts-expect-error React WebGLScene is exported only from the React entrypoint.
        import type { WebGLScene } from "${importPath}";
        // @ts-expect-error React WebGLCamera is exported only from the React entrypoint.
        import type { WebGLCamera } from "${importPath}";
        // @ts-expect-error React WebGLRenderPass is exported only from the React entrypoint.
        import type { WebGLRenderPass } from "${importPath}";

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
        const timelineActiveRange = {
          from: 0.2,
          to: 0.8,
        } satisfies WebGLTimelineActiveRangeDeclaration;
        const sceneTimeline =
          "hero.3d" satisfies WebGLTimelineBindingDeclaration;
        const activeTimeline = {
          id: "hero.3d",
          progressKey: "scroll.hero",
          active: timelineActiveRange,
        } satisfies WebGLTimelineBindingDeclaration;
        const sceneDeclaration = {
          id: "world",
          defaultCameraId: "world.camera",
          defaultPass: true,
          timeline: activeTimeline,
        } satisfies WebGLSceneDeclaration;

        const cameraDeclaration = {
          id: "world.camera",
          sceneId: "world",
          default: true,
          type: "orthographic",
          mode: "dom-aligned",
        } satisfies WebGLCameraDeclaration;
        const cameraControllerFrame = {
          position: [0, 120, 520],
          target: [0, 48, 0],
          fov: 34,
        } satisfies WebGLCameraControllerFrameDeclaration;
        const cameraControllerTimeline = {
          id: "hero.timeline",
          progressKey: "hero.progress",
          range: timelineActiveRange,
        } satisfies WebGLCameraControllerTimelineDeclaration;
        const cameraControllerEasing =
          "smoothstep" satisfies WebGLCameraControllerEasing;
        const cameraController = {
          timeline: cameraControllerTimeline,
          to: cameraControllerFrame,
          easing: cameraControllerEasing,
        } satisfies WebGLCameraControllerDeclaration;
        const cameraWithController = {
          id: "hero.camera",
          sceneId: "world",
          default: true,
          type: "perspective",
          mode: "perspective-stage",
          position: [0, 0, 700],
          target: [0, 0, 0],
          fov: 44,
          controller: cameraController,
        } satisfies WebGLCameraDeclaration;
        // @ts-expect-error WebGLCameraDeclaration keeps top-level timeline out of camera ownership.
        cameraWithController.timeline;
        // @ts-expect-error Camera controllers do not accept pass-bound public scope in v1.
        cameraController.pass;

        const passDeclaration = {
          id: "world.pass",
          sceneId: "world",
          cameraId: "world.camera",
          order: 0,
        } satisfies WebGLRenderPassDeclaration;
        const passViewport = {
          mode: "dom-rect",
          anchorId: "hero.stage.viewport",
          scissor: true,
        } satisfies WebGLPassViewportDeclaration;
        const passPostprocess = {
          bloom: { strength: 0.35, radius: 0.18, threshold: 0.82 },
          grain: { amount: 0.04 },
          blur: { radius: 0.12 },
        } satisfies WebGLPostprocessDeclaration;
        const canvasPostprocessScope = {
          canvas: true,
        } satisfies WebGLPostprocessScopeDeclaration;
        const passPostprocessScope = {
          passId: "hero.pass",
        } satisfies WebGLPostprocessScopeDeclaration;
        const passScopedPostprocess = {
          key: "hero.pass.fx",
          scope: passPostprocessScope,
          grain: { amount: 0.04 },
        } satisfies WebGLRuntimePostprocessRequest;
        const canvasScopedPostprocess = {
          key: "runtime.fx",
          scope: canvasPostprocessScope,
          blur: { radius: 0.1 },
        } satisfies WebGLRuntimePostprocessRequest;
        const scopedPass = {
          id: "hero.pass",
          sceneId: "hero.scene",
          cameraId: "hero.camera",
          viewport: passViewport,
          postprocess: passPostprocess,
        } satisfies WebGLRenderPassDeclaration;
        const stageColor = "#05070a" satisfies WebGLColorValue;
        const stagePlaneRole = "floor" satisfies WebGLStagePlaneRole;
        const stagePrimitiveKind = "plane" satisfies WebGLStagePrimitiveKind;
        const lightKind = "point" satisfies WebGLLightKind;
        const standardStageMaterial = {
          kind: "standard",
          color: stageColor,
          emissive: "#000000",
          emissiveIntensity: 0.25,
          opacity: 0.82,
          metalness: 0.1,
          roughness: 0.8,
        } satisfies WebGLStageMaterialDeclaration;
        const basicStageMaterial = {
          kind: "basic",
          color: 0xffffff,
          opacity: 0.5,
        } satisfies WebGLStageMaterialDeclaration;
        const stagePlaneDeclaration = {
          id: "stage.floor",
          sceneId: "world",
          kind: stagePrimitiveKind,
          role: stagePlaneRole,
          size: [1200, 800],
          material: standardStageMaterial,
          timeline: sceneTimeline,
        } satisfies WebGLStagePlaneDeclaration;
        const stageBoxDeclaration = {
          id: "stage.box",
          sceneId: "world",
          kind: "box",
          size: [120, 80, 120],
          position: [0, -40, 0],
          material: basicStageMaterial,
        } satisfies WebGLStageBoxDeclaration;
        const physicsBodyType = "dynamic" satisfies WebGLPhysicsBodyType;
        const physicsBody = {
          type: physicsBodyType,
          mass: 1,
          velocity: [0, 0, 0],
          damping: 0.08,
        } satisfies WebGLPhysicsBodyDeclaration;
        const physicsCollider = {
          kind: "box",
          size: [120, 20, 120],
        } satisfies WebGLColliderDeclaration;
        const physicsConstraint = {
          kind: "spring",
          target: [0, 20, 0],
          restLength: 0,
          stiffness: 0.18,
        } satisfies WebGLPhysicsConstraintDeclaration;
        const physicsPointerDrag = {
          stiffness: 0.28,
          damping: 0.16,
          maxForce: 1800,
        } satisfies WebGLPhysicsPointerDragDeclaration;
        const stagePhysics = {
          body: physicsBody,
          collider: physicsCollider,
          pointerDrag: physicsPointerDrag,
          constraints: [physicsConstraint],
        } satisfies WebGLPhysicsDeclaration;
        const physicsStageBoxDeclaration = {
          id: "stage.physics.box",
          sceneId: "world",
          kind: "box",
          physics: stagePhysics,
        } satisfies WebGLStageBoxDeclaration;
        const invalidPhysics = {
          body: { type: "dynamic" },
          // @ts-expect-error public physics descriptors cannot expose raw engine bodies.
          rigidBody: {},
        } satisfies WebGLPhysicsDeclaration;
        invalidPhysics satisfies WebGLPhysicsDeclaration;
        const stagePrimitiveDeclaration =
          stagePlaneDeclaration satisfies WebGLStagePrimitiveDeclaration;
        const lightDeclaration = {
          id: "stage.hero",
          sceneId: "world",
          kind: lightKind,
          color: "#7dd3fc",
          intensity: 1.8,
          position: [0, 0, 160],
          timeline: sceneTimeline,
        } satisfies WebGLLightDeclaration;
        declare const rawMixer: ThreeAnimationMixer;
        declare const rawAction: ThreeAnimationAction;
        declare const rawBone: ThreeBone;
        declare const rawSkeleton: ThreeSkeleton;
        declare const rawObject3D: ThreeObject3D;
        const modelLoop = "repeat" satisfies WebGLModelAnimationLoop;
        const modelDefaultClip = {
          clip: "MainSkeleton.001",
          loop: modelLoop,
          timeScale: 1,
          fadeInMs: 120,
          fadeOutMs: 80,
          clampWhenFinished: true,
        } satisfies WebGLModelClipPlaybackDeclaration;
        const explicitDefaultClips = [
          { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
          { clip: "SpeedLines.001", loop: "repeat" },
          "BagArmature.001",
        ] satisfies WebGLModelClipPlaybackDeclaration[];
        const modelScrub = {
          clip: "MainSkeleton.001",
          timeline: activeTimeline,
          durationSeconds: 1.4,
          range: timelineActiveRange,
        } satisfies WebGLModelClipScrubDeclaration;
        const modelBlend = {
          from: "MainSkeleton.001",
          to: "Walk",
          timeline: "hero.3d",
          fadeMs: 240,
          range: timelineActiveRange,
        } satisfies WebGLModelClipBlendDeclaration;
        const modelMorphWeight = {
          name: "Smile",
          timeline: "hero.3d",
          from: 0,
          to: 1,
        } satisfies WebGLModelMorphWeightDeclaration;
        const modelAnimation = {
          defaultClip: modelDefaultClip,
          defaultClips: explicitDefaultClips,
          scrub: modelScrub,
          blend: modelBlend,
          morphs: [modelMorphWeight],
        } satisfies WebGLModelAnimationDeclaration;
        modelAnimation.defaultClips?.map((clip) =>
          typeof clip === "string" ? clip : clip.clip,
        );
        // @ts-expect-error model animation descriptors must not expose raw mixers.
        ({ mixer: rawMixer } satisfies WebGLModelAnimationDeclaration);
        // @ts-expect-error defaultClips must be an explicit readonly list of playback declarations.
        ({ defaultClips: true } satisfies WebGLModelAnimationDeclaration);
        const modelPrepare = {
          renderWarmup: "idle",
        } satisfies WebGLModelPrepareDeclaration;
        const modelDeclaration = {
          id: "character",
          sceneId: "world",
          src: "/models/Sprint.glb",
          loader: { draco: { decoderPath: "/draco/" } },
          position: [0, -120, 0],
          rotation: [0, Math.PI, 0],
          scale: [120, 120, 120],
          visible: true,
				          timeline: activeTimeline,
				          animation: modelAnimation,
				          prepare: modelPrepare,
                  physics: stagePhysics,
                interaction: {
                  pickable: {
                    hitTest: "bounds",
                    pointer: { hover: true, press: true, click: true, drag: true },
                  },
                },
                effects: [{ kind: "app.modelHover" }],
			        } satisfies WebGLModelDeclaration;
        // @ts-expect-error model declarations do not accept raw Object3D handles.
        ({ id: "raw.model", sceneId: "world", src: "/raw.glb", object3D: rawObject3D } satisfies WebGLModelDeclaration);
        // @ts-expect-error model declarations do not accept raw AnimationMixer handles.
        ({ id: "raw.mixer", sceneId: "world", src: "/raw.glb", mixer: rawMixer } satisfies WebGLModelDeclaration);
        const rawActionClip = {
          clip: "Idle",
          // @ts-expect-error clip playback declarations do not accept raw AnimationAction handles.
          action: rawAction,
        } satisfies WebGLModelClipPlaybackDeclaration;
        rawActionClip satisfies WebGLModelClipPlaybackDeclaration;
        // @ts-expect-error model declarations do not accept raw Skeleton handles.
        ({ id: "raw.skeleton", sceneId: "world", src: "/raw.glb", skeleton: rawSkeleton } satisfies WebGLModelDeclaration);
        const rawBoneMorph = {
          name: "Smile",
          // @ts-expect-error morph descriptors do not accept raw Bone handles.
          bone: rawBone,
        } satisfies WebGLModelMorphWeightDeclaration;
        rawBoneMorph satisfies WebGLModelMorphWeightDeclaration;
        const rawMorphArray = {
          name: "Smile",
          // @ts-expect-error morph descriptors do not accept raw morphTargetInfluences arrays.
          morphTargetInfluences: [0],
        } satisfies WebGLModelMorphWeightDeclaration;
        rawMorphArray satisfies WebGLModelMorphWeightDeclaration;
        ({
          id: "raw.loader",
          sceneId: "world",
          src: "/raw.glb",
          loader: {
            // @ts-expect-error loader callbacks are not public escape hatches.
            configureLoader() {},
          },
        } satisfies WebGLModelDeclaration);
        ({
          // @ts-expect-error prepare descriptors must not expose raw render hooks.
          renderLoop() {},
        } satisfies WebGLModelPrepareDeclaration);

        const projection = "dom-aligned" satisfies WebGLSceneProjection;
        const cameraType = "orthographic" satisfies WebGLCameraType;
        const cameraMode = "dom-aligned" satisfies WebGLCameraMode;
        const screenScene = {
          id: "overlay",
          projection: "screen",
          defaultCameraId: "overlay.camera",
        } satisfies WebGLSceneDeclaration;
        const perspectiveScene = {
          id: "world",
          projection: "perspective-stage",
          defaultCameraId: "world.camera",
          defaultPass: true,
        } satisfies WebGLSceneDeclaration;
        const screenCamera = {
          id: "overlay.camera",
          sceneId: "overlay",
          type: "orthographic",
          mode: "screen",
          default: true,
        } satisfies WebGLCameraDeclaration;
        const perspectiveCamera = {
          id: "world.camera",
          sceneId: "world",
          type: "perspective",
          mode: "perspective-stage",
          fov: 50,
          near: 0.1,
          far: 2000,
          position: [0, 0, 500],
          target: [0, 0, 0],
        } satisfies WebGLCameraDeclaration;
        const screenPlacement = {
          mode: "screen-anchored",
          anchor: "top-right",
          offset: [-32, 32],
          size: [180, 48],
        } satisfies WebGLPlacementDeclaration;
        const perspectivePlacement = {
          mode: "screen-depth",
          depth: 500,
        } satisfies WebGLPlacementDeclaration;
	        const stagePlacement = {
	          mode: "stage-local",
	          position: [0, 0, 0],
	          rotation: [0, Math.PI, 0],
	          scale: 1.2,
	          size: [240, 240],
	        } satisfies WebGLPlacementDeclaration;
        const screenPlanePlacement = {
          mode: "screen-plane",
          planeId: "stage.floor",
          offset: [0, 4, 0],
          scale: [1, 1],
        } satisfies WebGLScreenPlanePlacementDeclaration;
        screenPlanePlacement satisfies WebGLPlacementDeclaration;
        const overlayDeclaration = {
          key: "overlay.badge",
          sceneId: "overlay",
          source: { kind: "dom", type: "element" },
          placement: screenPlacement,
        } satisfies WebGLDeclaration;
        const timelineDeclaration = {
          key: "timeline.target",
          timeline: activeTimeline,
          source: { kind: "dom", type: "element" },
        } satisfies WebGLDeclaration;
        const overlayPass = {
          id: "overlay.pass",
          sceneId: "overlay",
          cameraId: "overlay.camera",
          order: 10,
          clearDepth: true,
        } satisfies WebGLRenderPassDeclaration;
        const cameraFraming = {
          fov: 50,
          near: 0.1,
          far: 2000,
          position: [0, 0, 500],
          target: [0, 0, 0],
          zoom: 1,
        } satisfies WebGLCameraFramingDeclaration;
        "screen" satisfies WebGLSceneProjection;
        "perspective-stage" satisfies WebGLSceneProjection;
        "perspective" satisfies WebGLCameraType;
        "screen" satisfies WebGLCameraMode;
        "perspective-stage" satisfies WebGLCameraMode;
	        "screen-anchored" satisfies WebGLPlacementMode;
	        "screen-depth" satisfies WebGLPlacementMode;
	        "stage-local" satisfies WebGLPlacementMode;
        "screen-plane" satisfies WebGLPlacementMode;
        "top-right" satisfies WebGLScreenAnchor;
        [-32, 32] satisfies WebGLTuple2;
        [0, 0, 500] satisfies WebGLTuple3;

        sceneDeclaration satisfies WebGLSceneDeclaration;
        cameraDeclaration satisfies WebGLCameraDeclaration;
        passDeclaration satisfies WebGLRenderPassDeclaration;
        passViewport satisfies WebGLPassViewportDeclaration;
        passPostprocess satisfies WebGLPostprocessDeclaration;
        canvasPostprocessScope satisfies WebGLPostprocessScopeDeclaration;
        passPostprocessScope satisfies WebGLPostprocessScopeDeclaration;
        passScopedPostprocess satisfies WebGLRuntimePostprocessRequest;
        canvasScopedPostprocess satisfies WebGLRuntimePostprocessRequest;
        scopedPass satisfies WebGLRenderPassDeclaration;
        stageColor satisfies WebGLColorValue;
        standardStageMaterial satisfies WebGLStageMaterialDeclaration;
        basicStageMaterial satisfies WebGLStageMaterialDeclaration;
        stagePlaneDeclaration satisfies WebGLStagePrimitiveDeclaration;
        stageBoxDeclaration satisfies WebGLStagePrimitiveDeclaration;
        stagePrimitiveDeclaration satisfies WebGLStagePrimitiveDeclaration;
        lightDeclaration satisfies WebGLLightDeclaration;
        modelDefaultClip satisfies WebGLModelClipPlaybackDeclaration;
        modelScrub satisfies WebGLModelClipScrubDeclaration;
        modelBlend satisfies WebGLModelClipBlendDeclaration;
        modelMorphWeight satisfies WebGLModelMorphWeightDeclaration;
        modelAnimation satisfies WebGLModelAnimationDeclaration;
        modelDeclaration satisfies WebGLModelDeclaration;
        physicsStageBoxDeclaration satisfies WebGLStagePrimitiveDeclaration;
        const physicsDebugBody = {
          id: "stage.physics.box",
          sceneId: "world",
          sourceKind: "stage/box",
          type: "dynamic",
          active: true,
          collider: { kind: "box" },
          position: [0, 80, 0],
          velocity: [0, -8, 0],
          constraints: 1,
          pointerDrag: true,
        } satisfies WebGLDebugPhysicsBodySummary;
        const physicsDebug = {
          bodyCount: 1,
          activeBodyCount: 1,
          collisionCount: 0,
          bodies: [physicsDebugBody],
        } satisfies WebGLDebugPhysicsSummary;
        const debugWithPhysics = {
          targetCount: 0,
          renderableCount: 0,
          currentScrollMode: "page",
          pointer: {
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
            buttons: [],
            modifiers: { shift: false, alt: false, ctrl: false, meta: false },
          },
          physics: physicsDebug,
          targets: [],
        } satisfies WebGLDebugState;
        debugWithPhysics.physics satisfies WebGLDebugPhysicsSummary | undefined;
        timelineActiveRange satisfies WebGLTimelineActiveRangeDeclaration;
        sceneTimeline satisfies WebGLTimelineBindingDeclaration;
        activeTimeline satisfies WebGLTimelineBindingDeclaration;
        projection satisfies WebGLSceneProjection;
        cameraType satisfies WebGLCameraType;
        cameraMode satisfies WebGLCameraMode;
        screenScene satisfies WebGLSceneDeclaration;
        perspectiveScene satisfies WebGLSceneDeclaration;
        screenCamera satisfies WebGLCameraDeclaration;
        perspectiveCamera satisfies WebGLCameraDeclaration;
        screenPlacement satisfies WebGLPlacementDeclaration;
	        perspectivePlacement satisfies WebGLPlacementDeclaration;
	        stagePlacement satisfies WebGLPlacementDeclaration;
        screenPlanePlacement satisfies WebGLPlacementDeclaration;
        overlayDeclaration satisfies WebGLDeclaration;
        timelineDeclaration satisfies WebGLDeclaration;
        overlayPass satisfies WebGLRenderPassDeclaration;
        cameraFraming satisfies WebGLCameraFramingDeclaration;
		        const runtimeOptionsWithScrollAdapter = {
	          container: document.createElement("div"),
	          scrollAdapter,
	          progressSignals,
		          performanceBudget: {
		            maxActiveTargets: 48,
		            maxActiveSnapshots: 24,
		            maxActiveVideos: 2,
		            maxActiveModels: 4,
		            maxTextureSize: 4096,
		            maxConcurrentResourceLoads: 3,
		            maxDrawCalls: 120,
		            maxTextureCount: 96,
		            maxRenderTargetSize: 2048,
		            maxPostprocessRequests: 3,
		          } satisfies WebGLPerformanceBudget,
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
          {
            key: "subtree-card",
            source: { kind: "dom", type: "element" },
            transformScope: "subtree",
          },
          {
            key: "self-card",
            source: { kind: "dom", type: "element" },
            transformScope: "self",
          },
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
		        const dracoModelDeclaration = {
		          key: "model.draco",
		          source: {
		            kind: "model",
		            type: "glb",
		            src: "/models/4.glb",
		            loader: {
		              draco: {
		                decoderPath: "/draco/",
		                preload: true,
		              },
		            },
		          },
		          effects: [{ kind: "custom.managedThreeLike" }],
		        } satisfies WebGLDeclaration;
		        const runtimeOptionsWithModelLoader = {
		          container: document.createElement("div"),
		          modelLoader: {
		            draco: {
		              decoderPath: "/draco/",
		            },
		          },
		        } satisfies WebGLRuntimeOptions;
		        runtimeOptionsWithModelLoader satisfies WebGLRuntimeOptions;
		        runtimeOptionsWithModelLoader.modelLoader satisfies WebGLModelLoaderDeclaration;
	        "subtree" satisfies WebGLTransformScope;
	        "self" satisfies WebGLTransformScope;
	        // @ts-expect-error transformScope accepts only the public self/subtree union.
	        "branch" satisfies WebGLTransformScope;
        // @ts-expect-error transformScope accepts only the public self/subtree union.
        ({ key: "invalid-transform", transformScope: "branch" } satisfies WebGLDeclaration);
        // @ts-expect-error public declarations do not accept child-owned parent keys.
        ({ key: "invalid-parent", parent: "root" } satisfies WebGLDeclaration);
        // @ts-expect-error public declarations do not accept public group objects.
        ({ key: "invalid-group", group: { key: "root" } } satisfies WebGLDeclaration);
        declare const rawThreeCamera: unknown;
        declare const rawThreeMesh: unknown;
        declare const rawThreeMaterial: unknown;
        declare const rawThreeLight: unknown;
        // @ts-expect-error camera descriptors do not accept raw Three camera handles.
        ({ id: "raw.camera", sceneId: "world", camera: rawThreeCamera } satisfies WebGLCameraDeclaration);
        // @ts-expect-error stage primitive descriptors do not accept raw Three mesh handles.
        ({ id: "raw.stage", sceneId: "world", kind: "plane", mesh: rawThreeMesh } satisfies WebGLStagePrimitiveDeclaration);
        // @ts-expect-error stage material descriptors do not accept raw Three material handles.
        ({ id: "raw.material", sceneId: "world", kind: "plane", material: rawThreeMaterial } satisfies WebGLStagePrimitiveDeclaration);
        // @ts-expect-error light descriptors do not accept raw Three light handles.
        ({ id: "raw.light", sceneId: "world", kind: "point", light: rawThreeLight } satisfies WebGLLightDeclaration);
        // @ts-expect-error placement does not accept raw Object3D handles.
        ({ key: "raw.object", object3D: {} } satisfies WebGLDeclaration);
        // @ts-expect-error render passes do not accept raw render targets.
        ({ sceneId: "world", renderTarget: {} } satisfies WebGLRenderPassDeclaration);
        // @ts-expect-error pass viewport accepts managed descriptors, not renderer state.
        ({ mode: "dom-rect", renderer: {} } satisfies WebGLPassViewportDeclaration);
        // @ts-expect-error pass-scoped postprocess accepts descriptor data, not composer passes.
        ({ composer: {} } satisfies WebGLPostprocessDeclaration);
        // @ts-expect-error postprocess scope names a managed pass, not a render target.
        ({ key: "bad", scope: { renderTarget: {} } } satisfies WebGLRuntimePostprocessRequest);
        // @ts-expect-error runtime postprocess requests must declare canvas/pass scope.
        ({ key: "missing.scope", grain: { amount: 0.04 } } satisfies WebGLRuntimePostprocessRequest);
        declare const rawTimelineController: { progress(): number };
        // @ts-expect-error raw GSAP/controller objects are not timeline declarations.
        ({ id: "raw.timeline", timeline: rawTimelineController } satisfies WebGLSceneDeclaration);
        // @ts-expect-error camera declarations do not accept timeline in Phase 5.
        ({ id: "camera.timeline", sceneId: "world", timeline: "hero.3d" } satisfies WebGLCameraDeclaration);

	        const pointerDeclaration = {
	          hover: true,
	          press: true,
	          click: true,
	          drag: true,
	        } satisfies WebGLPointerDeclaration;
        const objectPointerDeclaration = {
          hover: true,
          press: true,
          click: true,
          drag: true,
        } satisfies WebGLObjectPointerDeclaration;
        const pickableDeclaration = {
          hitTest: "bounds",
          pointer: objectPointerDeclaration,
        } satisfies WebGLPickableDeclaration;
        const meshPickableDeclaration = {
          hitTest: "mesh",
          pointer: { hover: true, click: true },
        } satisfies WebGLPickableDeclaration;
        const sceneObjectInteraction = {
          pickable: pickableDeclaration,
        } satisfies WebGLSceneObjectInteractionDeclaration;
        objectPointerDeclaration satisfies WebGLObjectPointerDeclaration;
        pickableDeclaration satisfies WebGLPickableDeclaration;
        meshPickableDeclaration satisfies WebGLPickableDeclaration;
        sceneObjectInteraction satisfies WebGLSceneObjectInteractionDeclaration;
        const targetPointer = {
          localX: 24,
          localY: 16,
          normalizedX: -0.2,
          normalizedY: 0.5,
          isInside: true,
          isPressed: true,
          pressDuration: 320,
          isDragging: true,
          dragStartLocalX: 8,
          dragStartLocalY: 10,
          dragDeltaX: 16,
          dragDeltaY: 6,
          lastClickTime: 1000,
          clickCount: 1,
        } satisfies WebGLTargetPointerState;

        targetPointer satisfies WebGLTargetPointerState;
        declare const publicCtx: WebGLEffectContext;
	        publicCtx.object satisfies WebGLEffectObjectHandle;
	        publicCtx.object.material satisfies WebGLEffectMaterialFacade | undefined;
	        publicCtx.object.lights satisfies WebGLEffectLightsFacade | undefined;
	        publicCtx.object.animation satisfies WebGLEffectAnimationFacade | undefined;
	        publicCtx.resources satisfies WebGLEffectResourceScope;
	        publicCtx.runtime satisfies WebGLEffectRuntimeScope;
	        publicCtx.runtime.progress.get("section") satisfies number;
	        publicCtx.runtime.postprocess satisfies WebGLEffectRuntimePostprocessFacade;
	        publicCtx.runtime.postprocess.request({
	          key: "type.runtime.postprocess",
	          scope: { canvas: true },
	          grain: { amount: 0.04 },
	        }) satisfies WebGLEffectPostprocessHandle;
	        publicCtx.scene?.id satisfies string | undefined;
	        publicCtx.scene?.projection satisfies WebGLSceneProjection | undefined;
	        publicCtx.scene?.timeline?.progress satisfies number | undefined;
		        publicCtx.scene satisfies WebGLEffectSceneScope | undefined;
		        publicCtx.scene?.timeline satisfies WebGLEffectTimelineScope | undefined;
		        publicCtx.targetPointer.localX satisfies number;
		        publicCtx.progress.get("section") satisfies number;
        const sceneObjectEffect = defineWebGLSceneObjectEffect({
          kind: "app.modelHover",
          source: "model/glb",
          update(ctx) {
            ctx.objectId satisfies string;
            ctx.sourceKind satisfies WebGLSceneObjectEffectSourceKind;
            ctx.objectPointer.isHovered satisfies boolean;
            ctx.objectPointer.hit?.point satisfies WebGLTuple3 | undefined;
            ctx.scene.id satisfies string;
            ctx.runtime.progress.get("hero") satisfies number;
            ctx.object.rotation.y = 0;

            // @ts-expect-error scene-object effects do not expose DOM target layout.
            ctx.layout;
            // @ts-expect-error scene-object effects do not expose DOM target pointer state.
            ctx.targetPointer;
          },
        });
        sceneObjectEffect satisfies WebGLSceneObjectEffectDefinition;
        declare const sceneObjectCtx: WebGLSceneObjectEffectContext;
        sceneObjectCtx.objectPointer satisfies WebGLSceneObjectPointerState;
        const rawIntersectionEffect = defineWebGLSceneObjectEffect({
          kind: "app.rawIntersection",
          update(ctx) {
            // @ts-expect-error scene-object pointer state exposes managed hit summaries, not raw intersections.
            ctx.objectPointer.intersection.object;
          },
        });
        rawIntersectionEffect satisfies WebGLSceneObjectEffectDefinition;
	        const colorValue = "#7dd3fc" satisfies WebGLEffectColorValue;
	        declare const colorFacade: WebGLEffectColorLike;
	        declare const emissiveFacade: WebGLEffectEmissiveLike;
	        colorFacade.set(colorValue);
	        emissiveFacade.set(colorValue, 1.8);
	        const materialLayerOptions = {
	          key: "fixture.material",
	          program: {
	            fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
	          },
	        } satisfies WebGLEffectMaterialLayerOptions;
	        publicCtx.object.material?.createLayer(materialLayerOptions);
	        "object" satisfies WebGLEffectLightFollowMode;
	        ({ color: colorValue, intensity: 1 } satisfies WebGLEffectAmbientLightRequest);
	        ({
	          color: colorValue,
	          intensity: 1,
	          position: [0, 0, 1],
	          target: [0, 0, 0],
	          follow: "layout-center",
	        } satisfies WebGLEffectDirectionalLightRequest);
	        ({
	          color: colorValue,
	          intensity: 1,
	          distance: 120,
	          decay: 2,
	          position: [0, 0, 1],
	          follow: "none",
	        } satisfies WebGLEffectPointLightRequest);
		({
		  loop: "once",
		  fadeInMs: 120,
		  fadeOutMs: 80,
		  clampWhenFinished: true,
		  timeScale: 1,
		} satisfies WebGLEffectAnimationPlayOptions);
        ({ timeSeconds: 0.4 } satisfies WebGLEffectAnimationScrubOptions);
        ({ progress: 0.5, durationSeconds: 1.4 } satisfies WebGLEffectAnimationScrubOptions);
        ({ weight: 0.5, loop: "repeat", timeScale: 1 } satisfies WebGLEffectAnimationBlendOptions);
        ({ fadeMs: 180, loop: "repeat", timeScale: 1 } satisfies WebGLEffectAnimationCrossfadeOptions);

        // @ts-expect-error use ctx.object and ctx.sourceKind instead.
        publicCtx.source;
	        // @ts-expect-error use ctx.object transform controls instead.
	        publicCtx.target;
	        // @ts-expect-error use ctx.runtime.postprocess instead.
	        publicCtx.visual;
        // @ts-expect-error scene scope exposes managed metadata only, not raw Three scenes.
        publicCtx.scene?.scene;
        // @ts-expect-error target-local effects do not receive implicit camera scope.
        publicCtx.camera;

        // @ts-expect-error pointer.move is an event-level name, not the public target pointer contract.
        ({ move: true } satisfies WebGLPointerDeclaration);
        // @ts-expect-error long-press thresholds belong to effect params, not runtime pointer declarations.
        ({ longPress: true } satisfies WebGLPointerDeclaration);
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
				        const objectEffect = defineWebGLEffect({
				          kind: "custom.object",
				          update(ctx) {
				            ctx.object.position.set(1, 2, 3);
				            ctx.object.position.y += 4;
		 	            ctx.object.rotation.set(0, 0.5, 0);
		 	            ctx.object.scale.setScalar(1.1);
		 	            ctx.object.visible = true;
		 	            ctx.object.opacity = 0.75;
		 	            ctx.object.material?.color.set("#f8fafc");
		 	            ctx.object.material?.emissive.set("#7dd3fc", 1.8);
		 	            ctx.object.material?.createLayer({
		 	              key: "custom.materialLayer",
		 	              program: {
		 	                fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
		 	                blend: "additive",
		 	              },
		 	            });
		 	            ctx.object.lights?.point("glow", {
		 	              color: "#7dd3fc",
		 	              intensity: 2.4,
		 	              distance: 420,
		 	              follow: "object",
		 	            });
		 	            ctx.object.animation?.play("Idle", {
		 	              loop: "repeat",
		 	              fadeInMs: 120,
		 	              timeScale: 1,
		 	            });
                    ctx.runtime.postprocess.request({
                    key: "custom.glow",
                    scope: { canvas: true },
                    bloom: { strength: 0.2 },
                    });
				            ctx.object satisfies WebGLEffectObjectHandle;
				            ctx.object.position satisfies WebGLEffectVector3Like;
				            ctx.object.rotation satisfies WebGLEffectVector3Like;
				            ctx.object.scale satisfies WebGLEffectScaleLike;
				            ctx.object.text satisfies WebGLEffectTextFacade | undefined;
				            ctx.object.texture satisfies WebGLEffectTextureFacade | undefined;
				            ctx.object.video satisfies WebGLEffectVideoFacade | undefined;
				            ctx.object.model satisfies WebGLEffectModelFacade | undefined;
				            ctx.object.model?.meshes satisfies
				              | WebGLEffectModelMeshesFacade
				              | undefined;
				            ctx.object.model?.sampling satisfies
				              | WebGLEffectModelSamplingFacade
				              | undefined;
				            ctx.object.model?.points satisfies
				              | WebGLEffectModelPointsFacade
				              | undefined;
                    // @ts-expect-error postprocess moved from ctx.object to ctx.runtime in Phase 6.
                    ctx.object.postprocess.request({
                    key: "custom.oldObjectPostprocess",
                    grain: { amount: 0.04 },
                    });
				          },
				        });

		    objectEffect satisfies WebGLEffectDefinition;
		        const managedThreeLikeEffect = defineWebGLEffect({
		          kind: "custom.managedThreeLike",
		          update(ctx) {
		            ctx.object.position.set(0, 24, 0);
		            ctx.object.position.y += 4;
		            ctx.object.rotation.set(0, 0.5, 0);
		            ctx.object.rotation.y += ctx.delta / 1000;
		            ctx.object.scale.setScalar(1.08);
		            ctx.object.visible = true;
		            ctx.object.opacity = 0.86;

		            ctx.object.material?.color.set("#f8fafc");
		            ctx.object.material?.emissive.set("#7dd3fc", 1.8);
		            ctx.object.material?.createLayer({
		              key: "custom.materialLayer",
		              program: {
		                fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
		                blend: "additive",
		              },
		            });

		            ctx.object.lights?.point("glow", {
		              color: "#7dd3fc",
		              intensity: 2.4,
		              distance: 420,
		              follow: "object",
		            });

		            ctx.object.animation?.play("Idle", {
		              loop: "repeat",
		              fadeInMs: 120,
		              timeScale: 1,
		            });
                    ctx.object.animation?.scrub("Walk", {
                      progress: ctx.runtime.progress.get("hero.timeline"),
                      durationSeconds: 1.4,
                    });
                    ctx.object.animation?.blend("Idle", "Walk", {
                      weight: ctx.runtime.progress.get("hero.timeline"),
                      loop: "repeat",
                    });
                    ctx.object.animation?.crossFade("Idle", "Walk", {
                      fadeMs: 180,
                    });

                    ctx.runtime.postprocess.request({
                    key: "custom.softBloom",
                    scope: { canvas: true },
                    bloom: { strength: 0.45, radius: 0.25, threshold: 0.7 },
                    });
		          },
		        });

		        managedThreeLikeEffect satisfies WebGLEffectDefinition;
		        const objectOnlyEffect = defineWebGLEffect({
		          kind: "custom.objectOnly",
		          update(ctx) {
				            ctx.object.opacity = 1;
				            ctx.object.position.set(0, 24, 0);
				            ctx.object.rotation.y += ctx.delta / 1000;
				            ctx.object.scale.setScalar(1.05);
                    ctx.runtime.postprocess.request({
                    key: "custom.soft",
                    scope: { canvas: true },
                    blur: { radius: 0.2 },
                    });

				            ctx.object.surface?.draw(({ context }) => {
				              context.fillRect(0, 0, 1, 1);
				            });

				            ctx.object.text?.setGlyphs((glyphs) =>
				              glyphs.map((glyph) => ({
				                index: glyph.index,
				                char: glyph.char,
				              })),
				            );
				            ctx.object.text?.shaderInputs.glyphs satisfies
				              | readonly WebGLTextGlyph[]
				              | undefined;
				            ctx.object.text?.style.font satisfies string | undefined;

				            ctx.object.texture?.setTransform({ repeatX: 1, repeatY: 1 });
				            ctx.object.texture?.shaderInputs.uvTransform.repeatX satisfies
				              | number
				              | undefined;
				            ctx.object.texture?.src satisfies string | undefined;
				            ctx.object.texture?.frame satisfies number | undefined;

				            ctx.object.video?.setMuted(true);
				            ctx.object.video?.setPlaybackRate(1);

				            ctx.object.model?.points.create({
				              positions: ctx.object.model.sampling.vertices({ maxPoints: 128 }),
				            });
				            ctx.object.model?.src satisfies string | undefined;
				          },
				        });

				        objectOnlyEffect satisfies WebGLEffectDefinition;
				        // @ts-expect-error raw object3D is not public.
				        declare const rawObject: WebGLEffectContext["object"]["object3D"];
		 	        // @ts-expect-error raw mesh is not public.
		 	        declare const rawMesh: WebGLEffectContext["object"]["mesh"];
		 	        // @ts-expect-error raw material is not public.
		 	        declare const rawMaterial: WebGLEffectContext["object"]["rawMaterial"];
		 	        // @ts-expect-error raw texture handle is not public.
		 	        declare const rawTexture: WebGLEffectContext["object"]["rawTexture"];
		 	        // @ts-expect-error raw renderer is not public.
		 	        declare const rawRenderer: WebGLEffectContext["object"]["renderer"];
		 	        // @ts-expect-error raw scene is not public.
		 	        declare const rawScene: WebGLEffectContext["object"]["scene"];
		 	        // @ts-expect-error raw camera is not public.
		 	        declare const rawCamera: WebGLEffectContext["object"]["camera"];
		        declare const publicObject: WebGLEffectContext["object"];
		        // @ts-expect-error raw object3D remains runtime-owned.
		        publicObject.object3D;
		        // @ts-expect-error raw mesh remains runtime-owned.
		        publicObject.mesh;
		        // @ts-expect-error raw material remains runtime-owned.
		        publicObject.rawMaterial;
		        // @ts-expect-error raw light remains runtime-owned.
		        publicObject.rawLight;
		        // @ts-expect-error raw renderer remains runtime-owned.
		        publicObject.renderer;
		        // @ts-expect-error raw scene remains runtime-owned.
		        publicObject.scene;
		        // @ts-expect-error raw camera remains runtime-owned.
		        publicObject.camera;
		        // @ts-expect-error loader callbacks are not public escape hatches.
		        dracoModelDeclaration.source.loader.configureLoader;
		        // @ts-expect-error loaded GLTF callbacks are not public escape hatches.
		        dracoModelDeclaration.source.onGLTFLoaded;
		        "static" satisfies WebGLEffectSchedule;
				        "reactive" satisfies WebGLEffectSchedule;
				        "frame" satisfies WebGLEffectSchedule;
			        // @ts-expect-error effect schedules are a closed public union.
			        "idle" satisfies WebGLEffectSchedule;
			        defineWebGLEffect({
			          kind: "custom.reactiveSchedule",
			          schedule: "reactive",
			          update() {},
			        }) satisfies WebGLEffectDefinition<{ kind: "custom.reactiveSchedule" }>;
			        defineWebGLEffect({
			          kind: "custom.invalidSchedule",
			          // @ts-expect-error effect schedule only accepts static/reactive/frame.
			          schedule: "idle",
			          update() {},
			        });
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
				            ctx.resources satisfies WebGLEffectResourceScope;
                    const postprocess = ctx.runtime.postprocess.request({
                    key: "custom.glow",
                    scope: { passId: "hero.pass" },
                    bloom: { strength: 0.6, radius: 0.2, threshold: 0.8 },
                    grain: { amount: 0.05 },
                    blur: { radius: 0.25 },
                    } satisfies WebGLRuntimePostprocessRequest);
					            postprocess satisfies WebGLEffectPostprocessHandle;
					            const model = ctx.object.model;
					            if (model) {
					              model.points.create({
					                positions: model.sampling.vertices({ maxPoints: 2048 }),
					                color: "#7dd3fc",
					                size: 0.026,
					                material: {
				                  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
				                  uniforms: {
				                    sourceMap: { kind: "source-texture" },
				                  },
				                },
				              } satisfies WebGLEffectPointLayerOptions);
				              model.meshes.forEach((mesh) => {
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
			            ctx.object.position.set(0, 0, 0);
			            ctx.object.rotation.set(0, ctx.pointer.normalizedX, 0);
			          },
			        }) satisfies WebGLEffectDefinition<
			          { kind: "custom.glbParticles"; density?: number },
			          { density: number; scrollAtSetup: number }
			        >;

        const sourceCapabilityEffect = defineWebGLEffect({
          kind: "custom.sourceCapabilities",
          update(ctx) {
	            const surface = ctx.object.surface;
	            if (surface) {
	              surface satisfies WebGLEffectCanvasSurfaceHandle;
	              surface.shaderInputs satisfies WebGLEffectSurfaceShaderInputs;
	              surface.shaderInputs.size.width satisfies number;
	              surface.shaderInputs.sourceTexture satisfies
	                | WebGLEffectSourceTextureShaderInput
	                | undefined;
	              surface.shaderInputs.contentBox satisfies WebGLEffectContentBoxShaderInput;
	              surface.draw(({ context }) => {
	                context.fillRect(0, 0, 10, 10);
	              });
		              const publicProgram = {
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
		              } satisfies WebGLEffectMaterialProgram;
		              function acceptMaterialProgramKey<
		                TKey extends keyof WebGLEffectMaterialProgram,
		              >(_key: TKey): void {}
		              // @ts-expect-error material programs do not expose Three.js render-state fields.
		              acceptMaterialProgramKey("transparent");
		              // @ts-expect-error material programs do not expose Three.js render-state fields.
		              acceptMaterialProgramKey("depthWrite");
		              // @ts-expect-error material programs do not expose Three.js render-state fields.
		              acceptMaterialProgramKey("depthTest");
		              // @ts-expect-error material programs do not expose Three.js render-state fields.
		              acceptMaterialProgramKey("toneMapped");
		              function acceptSurfaceKey<
		                TKey extends keyof WebGLEffectCanvasSurfaceHandle,
		              >(_key: TKey): void {}
		              // @ts-expect-error surface texture is runtime-owned and not public.
		              acceptSurfaceKey("texture");
		              // @ts-expect-error surface mesh is runtime-owned and not public.
		              acceptSurfaceKey("mesh");
		              // @ts-expect-error surface material is runtime-owned and not public.
		              acceptSurfaceKey("material");
		              const layer = surface.createMaterialLayer({
		                key: "custom.surfaceShader",
		                sourceTextureUniform: "sourceMap",
		                mode: "replace-source",
		                program: publicProgram,
		              });
		              layer satisfies WebGLEffectMaterialLayerHandle;
		            }

	            const text = ctx.object.text;
	            if (text) {
	              text satisfies WebGLEffectTextFacade;
	              text.shaderInputs satisfies WebGLEffectTextShaderInputs;
	              text.shaderInputs.glyphs satisfies readonly WebGLTextGlyph[] | undefined;
	              text.style satisfies WebGLTextLayerStyle;
	              const glyphs = text.getGlyphs();
              glyphs satisfies readonly WebGLTextGlyph[];
              text.setGlyphs((entries) =>
                entries.map((glyph) => ({
                  index: glyph.index,
                  char: glyph.char,
                  scaleX: 1,
                  scaleY: 1,
	                  opacity: 1,
	                })),
	              );
	              text.material satisfies WebGLEffectMaterialLayerHost;
	            }

	            const texture = ctx.object.texture;
	            if (texture) {
	              texture satisfies WebGLEffectTextureFacade;
	              texture.shaderInputs satisfies WebGLEffectMediaShaderInputs;
	              texture.shaderInputs.naturalSize.width satisfies number | undefined;
	              texture.shaderInputs.uvTransform satisfies WebGLEffectObjectFitShaderInput;
	              texture.src satisfies string | undefined;
	              texture.frame satisfies number | undefined;
	              function acceptTextureKey<TKey extends keyof WebGLEffectTextureFacade>(
	                _key: TKey,
	              ): void {}
	              // @ts-expect-error media texture is runtime-owned and not public.
	              acceptTextureKey("texture");
	              // @ts-expect-error media mesh is runtime-owned and not public.
	              acceptTextureKey("mesh");
	              // @ts-expect-error media material is runtime-owned and not public.
	              acceptTextureKey("rawMaterial");
	              texture.setTransform({ repeatX: 1, repeatY: 1 });
	              texture.material.createMaterialLayer({
	                key: "custom.textureShader",
	                sourceTextureUniform: "sourceMap",
	                mode: "replace-source",
	                program: {
	                  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
	                  uniforms: {
	                    sourceMap: { kind: "source-texture" } satisfies WebGLEffectTextureUniform,
	                  },
	                },
	              });
	            }

	            const video = ctx.object.video;
	            if (video) {
	              video.setMuted(true);
	              video.setPlaybackRate(1);
	            }

	            const model = ctx.object.model;
	            if (model) {
	              model satisfies WebGLEffectModelFacade;
	              model.src satisfies string | undefined;
	              model.sampling.vertices({ maxPoints: 64 });
		              model.points.create({
		                positions: model.sampling.vertices({ maxPoints: 16 }),
		              });
                  model.morphs?.names() satisfies readonly string[] | undefined;
                  model.morphs?.get("Smile") satisfies number | undefined;
                  model.morphs?.set("Smile", 0.5);
                  model.rig?.bones() satisfies readonly string[] | undefined;
                  model.morphs satisfies WebGLEffectModelMorphsFacade | undefined;
                  model.rig satisfies WebGLEffectModelRigFacade | undefined;
		              model.meshes.forEach((mesh) => {
		                mesh.restoreMaterial();
		              });
	              function acceptModelKey<TKey extends keyof WebGLEffectModelFacade>(
	                _key: TKey,
	              ): void {}
	              // @ts-expect-error model root object is runtime-owned and not public.
	              acceptModelKey("object3D");
	              // @ts-expect-error raw mesh traversal is not public.
	              acceptModelKey("traverseMeshes");
	              // @ts-expect-error point-cloud objects are not returned as raw objects.
	              acceptModelKey("createPointCloud");
	              // @ts-expect-error model animation controls are not raw source handles.
	              model.animations;
	              // @ts-expect-error model light controls are not raw source handles.
	              model.requestLight;
	              // @ts-expect-error model picking controls are not raw source handles.
	              model.hitTest;
	              // @ts-expect-error material variants are not raw source handles.
	              model.materialVariants;
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
        customRuntime.registerStagePrimitive(stagePlaneDeclaration);
        customRuntime.unregisterStagePrimitive(stagePlaneDeclaration.id);
        customRuntime.registerLight(lightDeclaration);
        customRuntime.unregisterLight(lightDeclaration.id);
        customRuntime.registerModel(modelDeclaration);
        customRuntime.unregisterModel(modelDeclaration.id);
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
          buttons: [],
          modifiers: { shift: false, alt: false, ctrl: false, meta: false },
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
	        const performanceWarning = {
	          code: "performance-budget-exceeded",
	          target: "activeTargets",
	          count: 51,
	          limit: 50,
	        } satisfies WebGLPerformanceWarning;
	        function acceptPerformanceWarningTarget<
	          TKey extends WebGLPerformanceWarning["target"],
	        >(_key: TKey): void {}
		        acceptPerformanceWarningTarget("drawCalls");
		        acceptPerformanceWarningTarget("textureCount");
		        acceptPerformanceWarningTarget("renderTargetSize");
		        acceptPerformanceWarningTarget("postprocessRequests");
		        // @ts-expect-error raw renderer info objects are not public performance warnings.
		        acceptPerformanceWarningTarget("rendererInfo");
        const modelDebugDiagnostic = {
          kind: "missing-clip",
          name: "Walk",
        } satisfies WebGLDebugModelDiagnostic;
        const modelPrepareDebug = {
          load: "queued",
          renderWarmup: "pending",
        } satisfies WebGLDebugModelPrepareSummary;
        modelPrepareDebug.load;
        modelPrepareDebug.renderWarmup;
        // @ts-expect-error model prepare debug must not expose a loader handle.
        const invalidPrepareDebugLoader: WebGLDebugModelPrepareSummary = { loader: {} };
        // @ts-expect-error model prepare debug must not expose a render callback.
        const invalidPrepareDebugRender: WebGLDebugModelPrepareSummary = { render: () => {} };
        invalidPrepareDebugLoader;
        invalidPrepareDebugRender;
        const modelDebugSummary = {
          id: "hero.model",
          sceneId: "world",
          src: "/models/hero.glb",
          resourceStatus: "ready",
          visible: true,
          timeline: { id: "hero.timeline", progressKey: "hero.timeline", active: true },
          prepare: modelPrepareDebug,
          clips: ["Idle", "Walk"],
          activeClips: ["Idle"],
          morphs: ["Smile"],
          bones: ["Head"],
          diagnostics: [modelDebugDiagnostic],
        } satisfies WebGLDebugModelSummary;
	        const debugState = {
	          targetCount: 1,
	          renderableCount: 1,
	          currentScrollMode: "page",
	          pointer: frame.pointer,
	          warnings: [performanceWarning],
          modelCount: 1,
          models: [modelDebugSummary],
	          targets: [
            {
              key: declaration.key,
              sourceKind: "model/glb",
              renderRole: declaration.renderRole,
              resourceStatus,
              lifecycleState: "declared",
              visible: true,
              layerDepth: 0,
              siblingIndex: 0,
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
