import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const TYPECHECK_TEST_TIMEOUT_MS = 60_000;

describe("public package exports", () => {
  test("root entrypoint exposes runtime APIs without internal helpers", async () => {
    const rootApi = await import("../src/index");

    expect(rootApi.createWebGLRuntime).toEqual(expect.any(Function));
    expect(rootApi.defineWebGLEffect).toEqual(expect.any(Function));
    expect(rootApi).not.toHaveProperty("pointerTiltEffect");
    expect(rootApi).not.toHaveProperty("surfaceBasicEffect");
    expect(rootApi).not.toHaveProperty("createWebGLEffectRegistry");
    expect(rootApi).not.toHaveProperty("createTargetRegistry");
  });

  test("React entrypoint exposes the public React adapter", async () => {
    const reactApi = await import("../src/react");

    expect(reactApi.WebGLRuntime).toEqual(expect.any(Function));
    expect(reactApi.WebGLTarget).toEqual(expect.any(Function));
    expect(reactApi.WebGLScene).toEqual(expect.any(Function));
    expect(reactApi.WebGLCamera).toEqual(expect.any(Function));
    expect(reactApi.WebGLRenderPass).toEqual(expect.any(Function));
    expect(reactApi.WebGLStagePlane).toEqual(expect.any(Function));
    expect(reactApi.WebGLStageBox).toEqual(expect.any(Function));
    expect(reactApi.WebGLLight).toEqual(expect.any(Function));
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
        import {
          WebGLCamera,
          WebGLLight,
          WebGLRenderPass,
          WebGLRuntime,
          WebGLScene,
          WebGLStageBox,
          WebGLStagePlane,
          WebGLTarget,
        } from "${importPath}";
        import type {
          WebGLCameraProps,
          WebGLLightProps,
          WebGLRenderPassProps,
          WebGLRuntimeProps,
          WebGLSceneProps,
          WebGLSceneRenderOptions,
          WebGLStageBoxProps,
          WebGLStagePlaneProps,
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

            <WebGLScene
              id="world.stage"
              projection="perspective-stage"
              render={{ camera: "world.stage.camera", clearDepth: true }}
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

        const passProps = {
          id: "world.pass",
          scene: "world",
          camera: "world.camera",
          order: 0,
        } satisfies WebGLRenderPassProps;
        passProps satisfies WebGLRenderPassProps;

        declare const rawScene: ThreeScene;
        declare const rawCamera: ThreeCamera;
        declare const rawMesh: ThreeMesh;
        declare const rawMaterial: ThreeMaterial;
        declare const rawLight: ThreeLight;

        // @ts-expect-error WebGLScene does not accept a raw Three scene handle.
        const rawSceneProps = { id: "raw", scene: rawScene } satisfies WebGLSceneProps;

        // @ts-expect-error WebGLCamera does not accept a raw Three camera handle.
        const rawCameraProps = { id: "raw.camera", camera: rawCamera } satisfies WebGLCameraProps;

        // @ts-expect-error Stage planes do not accept raw Three mesh handles.
        const rawMeshPlaneProps = { id: "raw.plane", mesh: rawMesh } satisfies WebGLStagePlaneProps;

        // @ts-expect-error Stage material is a descriptor, not a raw Three material.
        const rawMaterialPlaneProps = { id: "raw.material", material: rawMaterial } satisfies WebGLStagePlaneProps;

        // @ts-expect-error WebGLLight is a descriptor, not a raw Three light wrapper.
        const rawLightProps = { id: "raw.light", light: rawLight } satisfies WebGLLightProps;

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
                  WebGLCameraDeclaration,
                  WebGLCameraFramingDeclaration,
                  WebGLCameraMode,
                  WebGLCameraType,
                  WebGLColorValue,
					          WebGLDebugState,
					          WebGLDeclaration,
				          WebGLEffectAmbientLightRequest,
				          WebGLEffectAnimationFacade,
				          WebGLEffectAnimationPlayOptions,
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
				          WebGLEffectPostprocessRequest,
				          WebGLEffectRenderableHandle,
				          WebGLEffectResourceScope,
				          WebGLEffectSchedule,
				          WebGLEffectContentBoxShaderInput,
					          WebGLEffectMediaShaderInputs,
					          WebGLEffectObjectFitShaderInput,
					          WebGLEffectModelFacade,
					          WebGLEffectModelMeshesFacade,
					          WebGLEffectModelPointsFacade,
					          WebGLEffectModelSamplingFacade,
					          WebGLEffectObjectHandle,
				          WebGLEffectPostprocessFacade,
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
					          WebGLModelMeshHandle,
					          WebGLEffectsDeclaration,
				          WebGLFrameInput,
				          WebGLGateScrollBehavior,
				          WebGLPerformanceBudget,
				          WebGLPerformanceWarning,
		          WebGLLifecycleDeclaration,
	          WebGLOffscreenLifecycleDeclaration,
	          WebGLOffscreenStrategy,
	          WebGLPlacementDeclaration,
	          WebGLPlacementMode,
		          WebGLDOMSourceDeclaration,
		          WebGLMediaImageSequenceSourceDeclaration,
		          WebGLMediaImageSourceDeclaration,
		          WebGLMediaSourceDeclaration,
			          WebGLMediaVideoPlaybackDeclaration,
			          WebGLMediaVideoSourceDeclaration,
			          WebGLModelLoaderDeclaration,
			          WebGLModelSourceDeclaration,
	          WebGLPointerDeclaration,
	          WebGLPointerState,
	          WebGLTargetPointerState,
	          WebGLProgressSignalSource,
	          WebGLRenderRole,
	          WebGLRenderPassDeclaration,
	          WebGLResourceStatus,
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
		          WebGLTextGlyph,
	          WebGLTextGlyphRenderCommand,
	          WebGLTextLayerStyle,
	          WebGLTuple2,
	          WebGLTuple3,
		        } from "${importPath}";

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
        // @ts-expect-error visual context is replaced by ctx.object.postprocess.
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
        const sceneDeclaration = {
          id: "world",
          defaultCameraId: "world.camera",
          defaultPass: true,
        } satisfies WebGLSceneDeclaration;

        const cameraDeclaration = {
          id: "world.camera",
          sceneId: "world",
          default: true,
          type: "orthographic",
          mode: "dom-aligned",
        } satisfies WebGLCameraDeclaration;

        const passDeclaration = {
          id: "world.pass",
          sceneId: "world",
          cameraId: "world.camera",
          order: 0,
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
        } satisfies WebGLStagePlaneDeclaration;
        const stageBoxDeclaration = {
          id: "stage.box",
          sceneId: "world",
          kind: "box",
          size: [120, 80, 120],
          position: [0, -40, 0],
          material: basicStageMaterial,
        } satisfies WebGLStageBoxDeclaration;
        const stagePrimitiveDeclaration =
          stagePlaneDeclaration satisfies WebGLStagePrimitiveDeclaration;
        const lightDeclaration = {
          id: "stage.hero",
          sceneId: "world",
          kind: lightKind,
          color: "#7dd3fc",
          intensity: 1.8,
          position: [0, 0, 160],
        } satisfies WebGLLightDeclaration;

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
        const overlayDeclaration = {
          key: "overlay.badge",
          sceneId: "overlay",
          source: { kind: "dom", type: "element" },
          placement: screenPlacement,
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
        "top-right" satisfies WebGLScreenAnchor;
        [-32, 32] satisfies WebGLTuple2;
        [0, 0, 500] satisfies WebGLTuple3;

        sceneDeclaration satisfies WebGLSceneDeclaration;
        cameraDeclaration satisfies WebGLCameraDeclaration;
        passDeclaration satisfies WebGLRenderPassDeclaration;
        stageColor satisfies WebGLColorValue;
        standardStageMaterial satisfies WebGLStageMaterialDeclaration;
        basicStageMaterial satisfies WebGLStageMaterialDeclaration;
        stagePlaneDeclaration satisfies WebGLStagePrimitiveDeclaration;
        stageBoxDeclaration satisfies WebGLStagePrimitiveDeclaration;
        stagePrimitiveDeclaration satisfies WebGLStagePrimitiveDeclaration;
        lightDeclaration satisfies WebGLLightDeclaration;
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
        overlayDeclaration satisfies WebGLDeclaration;
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

        const pointerDeclaration = {
          hover: true,
          press: true,
          click: true,
          drag: true,
        } satisfies WebGLPointerDeclaration;
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
	        publicCtx.targetPointer.localX satisfies number;
	        publicCtx.progress.get("section") satisfies number;
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
	        ({ loop: "once", fadeInMs: 120, timeScale: 1 } satisfies WebGLEffectAnimationPlayOptions);

        // @ts-expect-error use ctx.object and ctx.sourceKind instead.
        publicCtx.source;
        // @ts-expect-error use ctx.object transform controls instead.
        publicCtx.target;
        // @ts-expect-error use ctx.object.postprocess instead.
        publicCtx.visual;

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
		 	            ctx.object.postprocess.request({
		 	              key: "custom.glow",
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
				            ctx.object.postprocess satisfies WebGLEffectPostprocessFacade;
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

		            ctx.object.postprocess.request({
		              key: "custom.softBloom",
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
				            ctx.object.postprocess.request({
				              key: "custom.soft",
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
				            const postprocess = ctx.object.postprocess.request({
				              key: "custom.glow",
				              bloom: { strength: 0.6, radius: 0.2, threshold: 0.8 },
				              grain: { amount: 0.05 },
				              blur: { radius: 0.25 },
				            } satisfies WebGLEffectPostprocessRequest);
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
	        const debugState = {
	          targetCount: 1,
	          renderableCount: 1,
	          currentScrollMode: "page",
	          pointer: frame.pointer,
	          warnings: [performanceWarning],
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
