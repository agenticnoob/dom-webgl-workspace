import {
  createDebugState,
  type DebugRuntimeState,
} from "../debug/debugState";
import type {
  WebGLDebugState,
  WebGLDebugInteractionSummary,
  WebGLDeclaration,
  WebGLFrameInput,
  WebGLLifecycleState,
  WebGLProgressSignalSource,
  WebGLResourceStatus,
  WebGLRuntime,
  WebGLRuntimeOptions,
  WebGLScrollMetrics,
} from "../types";

import {
  createTargetRegistry,
  type TargetRegistry,
} from "../dom/registry";
import { createDOMInvalidationController } from "../dom/domInvalidation";
import type { DOMInvalidationController } from "../dom/domInvalidation";
import { markManagedFallbackRoot } from "../dom/fallbackBoundary";
import {
  createFallbackVisibilityController,
} from "../dom/fallbackVisibility";
import type { TargetDescriptor } from "../dom/targetDescriptor";
import { createTargetLayerTree } from "../dom/targetTree";
import {
  createWebGLEffectController,
  type WebGLEffectController,
} from "../effects/effectController";
import type { WebGLEffectScopeSnapshot } from "../effects/effectAuthoring";
import { createWebGLEffectScopeSnapshot } from "../effects/effectScopes";
import {
  createWebGLEffectRegistry,
  type WebGLEffectRegistry,
} from "../effects/effectRegistry";
import type { WebGLEffectTarget } from "../effects/effectTarget";
import {
  createFrameInputSource,
  type FrameClock,
  type ScrollStateController,
} from "../input/frameInput";
import { createNativeScrollAdapter } from "../input/scrollAdapter";
import {
  createPointerController,
  type PointerController,
} from "../input/pointerController";
import { createTargetPointerState } from "../input/targetPointer";
import {
  createScrollController,
  type ScrollController,
} from "../input/scrollController";
import { createScrollLockController } from "../input/scrollLock";
import {
  createRenderable,
  type RenderableFactoryContext,
} from "../render/renderableFactory";
import type { Renderable } from "../render/renderable";
import { createTransformGroupPlan } from "../render/transformGroups";
import { compileRenderPolicy, toSceneObjectOrdering } from "../render/renderPolicy";
import {
  toScopedManagedObjectOrdering,
  toScopedSceneObjectOrdering,
} from "../render/layerOrdering";
import { createObject3DEffectTarget } from "../render/renderables/effectTargets/elementPlaneEffectTarget";
import { createManagedLightsFacade } from "../render/renderables/managedLights";
import { inferRenderRole } from "../render/renderRole";
import { createResourceManager } from "../resources/resourceManager";
import { inferSourceDescriptor } from "../source/inferSource";
import {
  type DOMViewportSize,
  type ProjectedDOMRect,
} from "./domProjection";
import { projectTargetLayout } from "./projectionPolicies";
import { createLayoutPass, type ElementLayoutSnapshot } from "./layoutPass";
import { compileOffscreenPolicy } from "./offscreenPolicy";
import {
  createThreeRendererHost,
  type ThreeRendererHost,
} from "./threeRenderer";
import {
  createPostprocessController,
  type PostprocessController,
} from "./postprocessController";
import {
  createPassViewportRegistry,
  type ResolvedPassViewport,
} from "./passViewportRegistry";
import {
  createInteractionRouter,
  type ManagedHitCandidate,
  type ManagedHitTestPass,
} from "./interactionRouter";
import {
  createInternalRenderLayerRegistry,
  type InternalRenderLayerRegistry,
  type ManagedCameraGesturePass,
} from "./renderLayerRegistry";
import { createManagedModelRegistry } from "./managedModelRegistry";
import {
  readModelPrepareDecision,
  type ModelPreparePass,
} from "./modelPreparePolicy";
import { createStageObjectRegistry } from "./stageObjectRegistry";
import {
  generatedRenderLayerId,
  normalizeTargetPlacement,
  normalizeTargetSceneId,
} from "./renderLayerDeclarations";
import {
  createRendererLoop,
  type RenderDirtyReason,
  type RenderSchedulingMode,
} from "./rendererLoop";
import {
  createViewportLifecycle,
  type ViewportLifecycleState,
} from "./viewportLifecycle";
import {
  bumpLifecycleVersion,
  createTargetRuntimeState,
  createTrackedEffectTarget,
  disposeOffscreenRenderable,
  disposeTargetRenderable,
  disposeTargetRuntimeState,
  readEffectiveTargetVisibility,
  readLifecycleVersion,
  readRenderableVisibilityForPark,
  restoreFallbackVisibility,
  syncFallbackVisibility,
  type DisposableRenderable,
  type TargetDebugRecord,
  type TargetRuntimeState,
} from "./targetRuntimeState";
import type { WebGLSceneAdapter, WebGLSceneGroup } from "./sceneObject";
import { readTimelineProgress } from "../timeline/timelineDeclarations";

export type { WebGLRuntime, WebGLRuntimeOptions } from "../types";

type RuntimeInternalOptions = WebGLRuntimeOptions & {
  rendererHostFactory?: (container: HTMLElement) => ThreeRendererHost;
  renderables?: Iterable<DisposableRenderable>;
  measureElement?: RenderableFactoryContext["measureElement"];
  loadVideo?: RenderableFactoryContext["loadVideo"];
  loadModel?: RenderableFactoryContext["loadModel"];
  onRenderableCreated?: (renderable: Renderable) => void;
  scrollState?: RuntimeScrollController;
  pointerController?: PointerController;
  clock?: FrameClock;
  invalidationController?: DOMInvalidationController;
  postprocessController?: PostprocessController;
  renderLayerRegistryFactory?: (
    rendererHost: ThreeRendererHost,
  ) => InternalRenderLayerRegistry;
};

type RuntimeScrollController = ScrollStateController &
  Partial<
    Pick<
      ScrollController,
      | "registerGateTarget"
      | "unregisterGateTarget"
      | "releaseActiveGate"
      | "dispose"
    >
  >;

type PipelineRenderableContext = RenderableFactoryContext & {
  effectRegistry?: WebGLEffectRegistry;
  progressSignals?: WebGLProgressSignalSource;
  postprocessController?: PostprocessController;
  getEffectTarget?(
    descriptor: TargetDescriptor,
    renderable: Renderable,
  ): WebGLEffectTarget | undefined;
  readEffectScopes?(descriptor: TargetDescriptor): WebGLEffectScopeSnapshot;
};

type SyncFrameResult = {
  didSynchronousUpdate: boolean;
  schedulingMode: RenderSchedulingMode;
  pendingUpdate?: Promise<void>;
};

type RuntimeTransformGroupState = {
  sceneAdapter: WebGLSceneAdapter;
  group: WebGLSceneGroup;
  effectTarget?: WebGLEffectTarget;
  effectTargetObject3D?: unknown;
};

type ActiveResolvedPassViewport =
  | { mode: "canvas" }
  | {
      mode: "dom-rect";
      scissor: boolean;
      viewportRect: { x: number; y: number; width: number; height: number };
      scissorRect: { x: number; y: number; width: number; height: number };
    };

type BrowserDOMGlobals = typeof globalThis & {
  window?: unknown;
  document?: {
    createElement?: unknown;
  };
};

const missingDOMMessage =
  "createWebGLRuntime requires a browser DOM. Call it from a client/browser environment.";

export function createWebGLRuntime(options: WebGLRuntimeOptions): WebGLRuntime {
  assertBrowserDOMAvailable();
  const internalOptions = options as RuntimeInternalOptions;
  const rendererHostFactory =
    internalOptions.rendererHostFactory ?? createThreeRendererHost;
  const rendererHost = rendererHostFactory(options.container);
  const renderLayers =
    internalOptions.renderLayerRegistryFactory?.(rendererHost) ??
    createInternalRenderLayerRegistry(rendererHost);
  const passViewports = createPassViewportRegistry();
  const effectRegistry = createWebGLEffectRegistry(options.effects ?? []);
  const interactionRouter = createInteractionRouter();
  const stageObjects = createStageObjectRegistry({
    getSceneAdapter(sceneId) {
      return renderLayers.getSceneAdapterForTarget(sceneId);
    },
    effectRegistry,
    readEffectScopes(sceneId) {
      return readSceneObjectEffectScopes(sceneId);
    },
    readObjectPointerState(objectId) {
      return interactionRouter.getObjectPointerState(objectId);
    },
  });
  const mainScene = renderLayers.getScene(generatedRenderLayerId);
  const mainCamera = renderLayers.getCamera(generatedRenderLayerId);
  const mainSceneAdapter = renderLayers.getMainSceneAdapter();
  const registry = createTargetRegistry();
  let currentResourceLoadPriority: number | undefined;
  const resourceManager = createResourceManager({
    ...(options.performanceBudget ?? {}),
    readPriority: () => currentResourceLoadPriority,
  });
  const managedModels = createManagedModelRegistry({
    resourceManager,
    loadModel: internalOptions.loadModel,
    modelLoader: options.modelLoader,
    getSceneAdapter(sceneId) {
      return renderLayers.getSceneAdapterForTarget(sceneId);
    },
    effectRegistry,
    readEffectScopes(sceneId) {
      return readSceneObjectEffectScopes(sceneId);
    },
    readObjectPointerState(objectId) {
      return interactionRouter.getObjectPointerState(objectId);
    },
  });
  const scrollState =
    internalOptions.scrollState ??
    createScrollController({
      scrollAdapter:
        internalOptions.scrollAdapter ??
        createNativeScrollAdapter({
          readMetrics: readPageScrollMetrics,
          eventTarget: options.container,
        }),
      scrollLock: createScrollLockController(document.documentElement),
    });
  const ownerDocument = options.container.ownerDocument;
  const pointerController =
    internalOptions.pointerController ??
    createPointerController({
      coordinateElement: rendererHost.canvas,
      eventTarget: ownerDocument,
      onPointerInput() {
        if (hasPointerDrivenTarget()) {
          rendererLoopRequestFrame("pointer");
        }
      },
    });
  const frameInputSource = createFrameInputSource(
    scrollState,
    pointerController,
    internalOptions.clock ?? readClock,
  );
  const layoutPass = createLayoutPass({
    measureElement: internalOptions.measureElement ?? measureElement,
    getViewportSize: () => rendererHost.getViewportSize(),
    getDevicePixelRatio: () => window.devicePixelRatio || 1,
  });
  let requestRenderFrame: ((reason: RenderDirtyReason) => void) | undefined;
  let cameraInteractionSummary:
    | NonNullable<WebGLDebugInteractionSummary["cameraController"]>
    | undefined;
  const invalidationController =
    internalOptions.invalidationController ??
    createDOMInvalidationController({
      onDirtyTarget() {
        rendererLoopRequestFrame("dom-invalidation");
      },
    });
  const postprocessController =
    internalOptions.postprocessController ??
    createPostprocessController({
      renderer: rendererHost.renderer,
      scene: mainScene.scene,
      camera: mainCamera.camera,
      getViewportSize: () => rendererHost.getViewportSize(),
    });
  const targetState = createTargetRuntimeState(
    internalOptions.renderables ?? [],
  );
  const transformGroupsByKey = new Map<string, RuntimeTransformGroupState>();
  const transformProjectedLayoutsByTargetKey = new Map<string, ProjectedDOMRect>();
  const transformAttachmentGroupByTargetKey = new Map<
    string,
    string | undefined
  >();
  const fallbackRootUnmarkersByTargetKey = new Map<string, () => void>();
  // Created once at init. Margins stay with the lifecycle object;
  // viewportHeight is refreshed each frame through classify().
  // Future: allow margin overrides via WebGLRuntimeOptions.
  const viewportLifecycle = createViewportLifecycle();
  const renderableFactoryContext: PipelineRenderableContext = {
    resourceManager,
    sceneAdapter: mainSceneAdapter,
    measureElement: internalOptions.measureElement ?? measureElement,
    getViewportSize: () => rendererHost.getViewportSize(),
    loadVideo: internalOptions.loadVideo,
    loadModel: internalOptions.loadModel,
    modelLoader: options.modelLoader,
    effectRegistry,
    progressSignals: options.progressSignals,
    postprocessController,
    requestTextureFrame() {
      if (syncingFrame) {
        return;
      }

      rendererLoopRequestFrame("dom-invalidation");
    },
    getOrdering(descriptor, policy) {
      return (
        targetState.orderingsByTargetKey.get(descriptor.key) ??
        toSceneObjectOrdering(policy)
      );
    },
    getManagedObjectOrdering(descriptor) {
      return (
        targetState.managedOrderingsByTargetKey.get(descriptor.key) ??
        toSceneObjectOrdering(compileRenderPolicy("overlay"))
      );
    },
    getSceneAdapter(descriptor) {
      return readSceneAdapterForTarget(descriptor);
    },
    projectLayout(descriptor, measurement, viewport) {
      return (
        transformProjectedLayoutsByTargetKey.get(descriptor.key) ??
        projectTargetLayoutForDescriptor(descriptor, measurement, viewport)
      );
    },
    getEffectTarget(descriptor, renderable) {
      return readRuntimeEffectTarget(descriptor, renderable);
    },
    readEffectScopes(descriptor) {
      return readRuntimeEffectScopes(descriptor);
    },
  };
  let nextScanOrder = 0;
  let disposed = false;
  let lastDebugEmit = 0;
  let syncingFrame = false;

  // Tracks the last measured far/disposed rect per target. Small scroll steps
  // can reuse this state to avoid reading DOM rects for safely distant targets.
  type RectSkipState = {
    lastTop: number;
    layoutScrollOffset: number;
    viewport: ElementLayoutSnapshot["viewport"];
    frames: number;
    skippedFrames: number;
  };
  const rectSkipStabilityFrames = 3;
  const rectSkipMaxSkippedFrames = 3;
  const rectSkipState = new Map<string, RectSkipState>();
  const layoutCacheKeysByTargetKey = new Map<string, string>();
  let layoutScrollOffset = 0;
  const unsubscribeProgressSignals = options.progressSignals?.subscribe?.(() => {
    rendererLoopRequestFrame("scroll");
  });
  const emptyProgressSignals: WebGLProgressSignalSource = {
    get() {
      return 0;
    },
  };

  const rendererLoop = createRendererLoop({
    renderer: rendererHost.renderer,
    beforeRender(_time, frame) {
      try {
        const result = syncFrame(frame.dirtyReasons);
        watchResourceReadyUpdate(result);
        return { mode: result.schedulingMode };
      } catch (error: unknown) {
        console.error("WebGL runtime frame sync failed.", error);
        return { mode: "continuous" };
      }
    },
    render() {
      renderScene();
    },
  });
  requestRenderFrame = rendererLoop.requestFrame;

  ownerDocument.addEventListener("visibilitychange", handleVisibilityChange);
  rendererLoop.start();

  return {
    container: options.container,
    registerScene(declaration) {
      if (disposed) {
        throw new Error("Cannot register a WebGL scene after runtime disposal.");
      }

      renderLayers.registerScene(declaration);
      rendererLoopRequestFrame("target-register");
      emitDebugState(true);
    },
    unregisterScene(id) {
      const sceneId = id.trim();

      if (sceneId !== generatedRenderLayerId) {
        stageObjects.unregisterScene(sceneId);
        managedModels.unregisterScene(sceneId);
        unregisterTargetsForScene(sceneId);
      }

      renderLayers.unregisterScene(sceneId);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    registerCamera(declaration) {
      if (disposed) {
        throw new Error("Cannot register a WebGL camera after runtime disposal.");
      }

      renderLayers.registerCamera(declaration);
      rendererLoopRequestFrame("target-register");
      emitDebugState(true);
    },
    unregisterCamera(id) {
      renderLayers.unregisterCamera(id);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    registerRenderPass(declaration) {
      if (disposed) {
        throw new Error(
          "Cannot register a WebGL render pass after runtime disposal.",
        );
      }

      renderLayers.registerRenderPass(declaration);
      rendererLoopRequestFrame("target-register");
      emitDebugState(true);
    },
    unregisterRenderPass(id) {
      renderLayers.unregisterRenderPass(id);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    registerPassViewport(declaration) {
      if (disposed) {
        throw new Error(
          "Cannot register a WebGL pass viewport after runtime disposal.",
        );
      }

      passViewports.register(declaration);
      rendererLoopRequestFrame("target-register");
      emitDebugState(true);
    },
    unregisterPassViewport(id) {
      passViewports.unregister(id);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    registerStagePrimitive(declaration) {
      if (disposed) {
        throw new Error(
          "Cannot register a WebGL stage primitive after runtime disposal.",
        );
      }

      stageObjects.registerStagePrimitive(declaration);
      rendererLoopRequestFrame("target-register");
      emitDebugState(true);
    },
    unregisterStagePrimitive(id) {
      stageObjects.unregisterStagePrimitive(id);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    registerLight(declaration) {
      if (disposed) {
        throw new Error("Cannot register a WebGL light after runtime disposal.");
      }

      stageObjects.registerLight(declaration);
      rendererLoopRequestFrame("target-register");
      emitDebugState(true);
    },
    unregisterLight(id) {
      stageObjects.unregisterLight(id);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    registerModel(declaration) {
      if (disposed) {
        throw new Error("Cannot register a WebGL model after runtime disposal.");
      }

      managedModels.registerModel(declaration);
      rendererLoopRequestFrame("target-register");
      emitDebugState(true);
    },
    unregisterModel(id) {
      managedModels.unregisterModel(id);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    registerTarget(element, declaration) {
      if (disposed) {
        throw new Error("Cannot register a WebGL target after runtime disposal.");
      }

      const descriptor = registry.register(element, declaration, nextScanOrder);
      fallbackRootUnmarkersByTargetKey.set(
        descriptor.key,
        markManagedFallbackRoot(descriptor.element, descriptor.key),
      );
      nextScanOrder += 1;
      registerGateTarget(scrollState, descriptor);
      invalidationController.observeTarget({
        key: descriptor.key,
        element: descriptor.element,
      });
      rendererLoopRequestFrame("target-register");
      emitDebugState(true);

      return;
    },
    unregisterTarget(key) {
      unregisterRuntimeTarget(key);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    sync() {
      if (disposed) {
        return;
      }

      const result = syncFrame(["manual-sync"]);

      if (result.pendingUpdate) {
        if (result.didSynchronousUpdate) {
          renderScene();
        }

        return result.pendingUpdate.then(() => {
          renderScene();
        });
      }

      renderScene();
    },
    getDebugState() {
      return createCurrentDebugState();
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      try {
        disposeTargetRuntimeState(targetState);
      } finally {
        ownerDocument.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        invalidationController.dispose();
        unsubscribeProgressSignals?.();
        rectSkipState.clear();
        layoutCacheKeysByTargetKey.clear();
        transformProjectedLayoutsByTargetKey.clear();
        transformAttachmentGroupByTargetKey.clear();
        removeAllTransformGroups();
        releaseActiveGate(scrollState);
        scrollState.dispose?.();
        pointerController.dispose();
        rendererLoop.dispose();
        passViewports.dispose();
        postprocessController.dispose();
        stageObjects.dispose();
        managedModels.dispose();
        interactionRouter.dispose();
        renderLayers.dispose();
        rendererHost.dispose();
        unmarkAllFallbackRoots();
        emitDebugState(true);
      }
    },
  };

  function createCurrentDebugState(): WebGLDebugState {
    const descriptors = listTargetsInScanOrder(registry);
    const frameInput = frameInputSource.getState();
    const scroll = scrollState.getState();
    const stageObjectDebugState = disposed
      ? { stagePrimitives: [], lights: [] }
      : stageObjects.inspect();
    const modelDebugState = disposed ? { models: [] } : managedModels.inspect();

    if (disposed) {
      return createDebugState({
        targetCount: 0,
        renderableCount: 0,
        ...readDebugScrollState(scroll),
        pointer: frameInput.pointer,
        performanceBudget: options.performanceBudget,
        stagePrimitives: [],
        lights: [],
        models: [],
        targets: [],
      });
    }

    return createDebugState({
      targetCount: descriptors.length,
      renderableCount: targetState.renderablesByTargetKey.size,
      ...readDebugScrollState(scroll),
      pointer: frameInput.pointer,
      performanceBudget: options.performanceBudget,
      textureTelemetry: Array.from(
        targetState.renderablesByTargetKey.values(),
        (renderable) => renderable.inspectTextureTelemetry?.() ?? [],
      ).flat(),
      rendererStats: rendererHost.readRendererStats(),
      postprocessStats: postprocessController.inspect(),
      stagePrimitives: stageObjectDebugState.stagePrimitives,
      lights: stageObjectDebugState.lights,
      models: modelDebugState.models,
      interaction: readInteractionDebugSummary(),
      renderPasses: renderLayers.getPasses().map((pass) => ({
        id: pass.id,
        sceneId: pass.sceneId,
        ...(pass.cameraId ? { cameraId: pass.cameraId } : {}),
        viewportMode:
          pass.viewport?.mode === "dom-rect" ? "dom-rect" : "canvas",
        ...(pass.viewport?.mode === "dom-rect"
          ? { viewportAnchorId: pass.viewport.anchorId }
          : {}),
        postprocess: pass.postprocess !== undefined,
      })),
      cameraControllers: renderLayers.inspectCameraControllers(),
      targets: descriptors.map((descriptor) => {
        const layer = targetState.targetLayersByTargetKey.get(descriptor.key);
        const ordering = targetState.orderingsByTargetKey.get(descriptor.key);
        const sceneId = normalizeTargetSceneId(descriptor.declaration.sceneId);
        const scene = renderLayers.getScene(sceneId);
        const placement = normalizeTargetPlacement(descriptor.declaration.placement);

        return {
          key: descriptor.key,
          sceneId,
          projection: scene.projection,
          placementMode: placement.mode,
          ...readTargetDebugRecord(descriptor, targetState),
          parentKey: layer?.parentKey,
          layerDepth: layer?.depth ?? 0,
          siblingIndex: layer?.siblingIndex ?? 0,
          computedRenderOrder: ordering?.renderOrder,
        };
      }),
    });
  }

  function emitDebugState(force = false): void {
    if (!force) {
      const now = performance.now();
      if (now - lastDebugEmit < 100) { // throttle to ~10fps
        return;
      }
      lastDebugEmit = now;
    }
    internalOptions.onDebugStateChange?.(createCurrentDebugState());
  }

  function renderScene(): void {
    if (disposed) {
      return;
    }

    rendererHost.renderer.clear?.();

    renderLayers.renderPasses((pass, scene, camera) => {
      if (pass.clear) {
        rendererHost.renderer.clear?.();
      }
      if (pass.clearDepth) {
        rendererHost.renderer.clearDepth?.();
      }

      const resolvedViewport = passViewports.resolve(pass.viewport);
      const activeViewport = resolveActivePassViewport(resolvedViewport);
      if (!activeViewport) {
        return;
      }

      withResolvedPassViewport(activeViewport, () => {
        postprocessController.render(
          {
            passId: pass.id,
            viewport: readPostprocessViewport(activeViewport),
            descriptor: pass.postprocess,
            prepareOutput() {
              applyResolvedPassViewport(activeViewport);
            },
          },
          () => {
            scene.sceneAdapter.render(camera.camera);
          },
        );
      });
    });
    renderModelWarmups();
  }

  function renderModelWarmups(): void {
    const requests = managedModels.consumeRenderWarmupRequests();
    if (requests.length === 0) {
      return;
    }

    const pending = new Set(requests.map((request) => request.sceneId));

    renderLayers.renderPasses((pass, scene, camera) => {
      if (!pending.has(pass.sceneId)) {
        return;
      }

      withResolvedPassViewport(readWarmupViewport(), () => {
        scene.sceneAdapter.render(camera.camera);
      });

      for (const request of requests) {
        if (request.sceneId === pass.sceneId) {
          managedModels.markRenderWarmupComplete(request.id);
        }
      }
      pending.delete(pass.sceneId);
    });
  }

  function readWarmupViewport(): ActiveResolvedPassViewport {
    return {
      mode: "dom-rect",
      scissor: true,
      viewportRect: { x: 0, y: 0, width: 1, height: 1 },
      scissorRect: { x: 0, y: 0, width: 1, height: 1 },
    };
  }

  function readModelPreparePasses(): ModelPreparePass[] {
    return renderLayers.getPasses().map((pass) => ({
      sceneId: pass.sceneId,
      viewport: readModelPrepareViewport(pass.viewport),
    }));
  }

  function readModelPrepareViewport(
    viewport: Parameters<typeof passViewports.resolve>[0],
  ): ModelPreparePass["viewport"] {
    const resolved = passViewports.resolve(viewport);
    if (resolved.mode === "canvas") {
      return { mode: "canvas" };
    }

    return {
      mode: "dom-rect",
      rect: resolved.rect,
    };
  }

  function updateSceneObjectInteractions(frameInput: WebGLFrameInput): {
    readonly emptySpace: boolean;
    readonly debug: WebGLDebugInteractionSummary;
  } {
    const candidates = collectManagedHitCandidates();

    return interactionRouter.update({
      input: frameInput,
      passes: candidates.length > 0 ? readManagedHitTestPasses() : [],
      candidates,
      pickManagedObjects(pass, candidates) {
        return rendererHost.pickManagedObjects?.(
          pass,
          candidates,
          frameInput.pointer,
        );
      },
    });
  }

  function isCameraPointerBlocked(
    interaction: WebGLDebugInteractionSummary,
  ): boolean {
    return Boolean(
      interaction.activeHit ||
        interaction.pressedObjectId ||
        interaction.capturedObjectId,
    );
  }

  function readInteractionDebugSummary(): WebGLDebugInteractionSummary {
    const objectInteraction = interactionRouter.inspect();
    return {
      ...objectInteraction,
      ...(cameraInteractionSummary
        ? { cameraController: cameraInteractionSummary }
        : {}),
    };
  }

  function collectManagedHitCandidates(): ManagedHitCandidate[] {
    return [
      ...stageObjects.collectHitCandidates(),
      ...managedModels.collectHitCandidates(),
    ];
  }

  function readManagedHitTestPasses(): ManagedHitTestPass[] {
    const passes: ManagedHitTestPass[] = [];

    renderLayers.renderPasses((pass, _scene, camera) => {
      const resolvedViewport = passViewports.resolve(pass.viewport);
      const viewport =
        resolvedViewport.mode === "dom-rect" ? resolvedViewport.rect : undefined;

      passes.push({
        id: pass.id,
        sceneId: pass.sceneId,
        order: pass.order,
        camera: camera.camera,
        ...(viewport ? { viewport } : {}),
      });
    });

    return passes;
  }

  function readManagedCameraGesturePasses(): ManagedCameraGesturePass[] {
    const passes: ManagedCameraGesturePass[] = [];

    for (const pass of renderLayers.getPasses()) {
      const scene = renderLayers.getScene(pass.sceneId);
      const cameraId =
        pass.cameraId ?? scene.defaultCameraId ?? generatedRenderLayerId;
      let camera;
      try {
        camera = renderLayers.getCamera(cameraId);
      } catch (error: unknown) {
        if (pass.deferUntilCamera) {
          continue;
        }
        throw error;
      }

      if (scene.timeline?.active && scene.timelineActive === false) {
        continue;
      }
      if (camera.sceneId !== scene.id) {
        continue;
      }

      const resolvedViewport = passViewports.resolve(pass.viewport);
      const viewport =
        resolvedViewport.mode === "dom-rect" ? resolvedViewport.rect : undefined;

      passes.push({
        id: pass.id,
        sceneId: pass.sceneId,
        cameraId: camera.id,
        order: pass.order,
        ...(viewport ? { viewport } : {}),
      });
    }

    return passes;
  }

  function readPostprocessViewport(
    viewport: ActiveResolvedPassViewport,
  ): { width: number; height: number } {
    if (viewport.mode === "canvas") {
      return rendererHost.getViewportSize();
    }

    return {
      width: viewport.viewportRect.width,
      height: viewport.viewportRect.height,
    };
  }

  function resolveActivePassViewport(
    viewport: ResolvedPassViewport,
  ): ActiveResolvedPassViewport | undefined {
    if (viewport.mode === "canvas") {
      return viewport;
    }

    const runtimeViewport = rendererHost.getViewportSize();
    const canvasRect = readCanvasViewportRect(runtimeViewport);
    const left = Math.max(canvasRect.x, viewport.rect.x);
    const top = Math.max(canvasRect.y, viewport.rect.y);
    const right = Math.min(
      canvasRect.x + canvasRect.width,
      viewport.rect.x + viewport.rect.width,
    );
    const bottom = Math.min(
      canvasRect.y + canvasRect.height,
      viewport.rect.y + viewport.rect.height,
    );
    const width = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) {
      return undefined;
    }

    return {
      mode: "dom-rect",
      scissor: viewport.scissor,
      viewportRect: {
        x: viewport.rect.x - canvasRect.x,
        y: viewport.rect.y - canvasRect.y,
        width: viewport.rect.width,
        height: viewport.rect.height,
      },
      scissorRect: {
        x: left - canvasRect.x,
        y: top - canvasRect.y,
        width,
        height,
      },
    };
  }

  function readCanvasViewportRect(runtimeViewport: DOMViewportSize): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const rect = rendererHost.canvas.getBoundingClientRect();
    const width = readPositiveFiniteNumber(rect.width, runtimeViewport.width);
    const height = readPositiveFiniteNumber(rect.height, runtimeViewport.height);

    return {
      x: readFiniteNumber(rect.left, 0),
      y: readFiniteNumber(rect.top, 0),
      width,
      height,
    };
  }

  function readFiniteNumber(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
  }

  function readPositiveFiniteNumber(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function applyResolvedPassViewport(viewport: ActiveResolvedPassViewport): void {
    if (viewport.mode === "canvas") {
      return;
    }

    const runtimeViewport = rendererHost.getViewportSize();
    const viewportX = Math.round(viewport.viewportRect.x);
    const viewportWidth = Math.round(viewport.viewportRect.width);
    const viewportHeight = Math.round(viewport.viewportRect.height);
    const viewportY = Math.round(
      runtimeViewport.height -
        viewport.viewportRect.y -
        viewport.viewportRect.height,
    );
    const scissorX = Math.round(viewport.scissorRect.x);
    const scissorWidth = Math.round(viewport.scissorRect.width);
    const scissorHeight = Math.round(viewport.scissorRect.height);
    const scissorY = Math.round(
      runtimeViewport.height -
        viewport.scissorRect.y -
        viewport.scissorRect.height,
    );

    rendererHost.renderer.setViewport?.(
      viewportX,
      viewportY,
      viewportWidth,
      viewportHeight,
    );
    rendererHost.renderer.setScissor?.(
      scissorX,
      scissorY,
      scissorWidth,
      scissorHeight,
    );
    rendererHost.renderer.setScissorTest?.(viewport.scissor);
  }

  function withResolvedPassViewport(
    viewport: ActiveResolvedPassViewport,
    render: () => void,
  ): void {
    if (viewport.mode === "canvas") {
      render();
      return;
    }

    applyResolvedPassViewport(viewport);

    try {
      render();
    } finally {
      const runtimeViewport = rendererHost.getViewportSize();
      const fullWidth = Math.round(runtimeViewport.width);
      const fullHeight = Math.round(runtimeViewport.height);
      rendererHost.renderer.setScissorTest?.(false);
      rendererHost.renderer.setViewport?.(0, 0, fullWidth, fullHeight);
      rendererHost.renderer.setScissor?.(0, 0, fullWidth, fullHeight);
    }
  }

  function rendererLoopRequestFrame(reason: RenderDirtyReason): void {
    requestRenderFrame?.(reason);
  }

  function watchResourceReadyUpdate(result: SyncFrameResult): void {
    result.pendingUpdate?.catch((error: unknown) => {
      console.error("WebGL runtime async resource update failed.", error);
    });
  }

  function measureTargetLayouts(
    descriptors: TargetDescriptor[],
    dirtyKeys: ReadonlySet<string>,
  ): Map<string, ElementLayoutSnapshot> {
    const viewport = rendererHost.getViewportSize();
    const viewportHeight = viewport.height || window.innerHeight || 600;
    const unloadPx = (250 / 100) * viewportHeight;
    const safetyPx = viewportHeight * 0.5;
    const largeScrollJumpPx = viewportHeight;
    const targets: Array<{
      key: string;
      element: HTMLElement;
      active: true;
    }> = [];

    for (const descriptor of descriptors) {
      const state = rectSkipState.get(descriptor.key);
      let shouldMeasure = true;

      if (
        state &&
        state.frames >= rectSkipStabilityFrames &&
        state.skippedFrames < rectSkipMaxSkippedFrames &&
        !dirtyKeys.has(descriptor.key)
      ) {
        const scrollDelta = layoutScrollOffset - state.layoutScrollOffset;
        const estimatedTop = state.lastTop - scrollDelta;
        const viewportChanged =
          state.viewport.width !== viewport.width ||
          state.viewport.height !== viewport.height;
        const largeScrollJump = Math.abs(scrollDelta) >= largeScrollJumpPx;

        shouldMeasure =
          viewportChanged ||
          largeScrollJump ||
          !isSafelyFarFromViewport(estimatedTop, viewportHeight, unloadPx, safetyPx);
      }

      if (shouldMeasure) {
        targets.push({
          key: descriptor.key,
          element: descriptor.element,
          active: true,
        });
      }
    }

    try {
      const measurements = layoutPass.measure(targets);

      return measurements;
    } catch (error: unknown) {
      for (const descriptor of descriptors) {
        markDebugRecordError(
          readTargetDebugRecord(descriptor, targetState),
          error,
        );
      }
      releaseActiveGate(scrollState);
      emitDebugState(true);
      throw error;
    }
  }

  function isSafelyFarFromViewport(
    estimatedTop: number,
    viewportHeight: number,
    unloadPx: number,
    safetyPx: number,
  ): boolean {
    return (
      estimatedTop > unloadPx + safetyPx ||
      estimatedTop < -(unloadPx + safetyPx + viewportHeight)
    );
  }

  function readViewportResourceLoadPriority(
    viewportState: ViewportLifecycleState,
  ): number {
    switch (viewportState) {
      case "active":
        return 100;
      case "preloading":
        return 50;
      case "mounted":
        return 10;
      case "disposed":
        return 0;
    }
  }

  function reconcileOffscreenTarget(
    viewportState: ViewportLifecycleState,
    descriptor: TargetDescriptor,
    renderable: Renderable | undefined,
    frameInput: WebGLFrameInput,
    debugRecord: TargetDebugRecord,
  ): boolean {
    if (viewportState === "disposed") {
      disposeOffscreenRenderable(targetState, {
        key: descriptor.key,
        renderable,
        restoreFallback: true,
      });
      debugRecord.lifecycleState = "disposed";
      debugRecord.visible = false;
      return true;
    }

    const offscreenPolicy = compileOffscreenPolicy(
      descriptor.declaration.lifecycle,
    );

    if (
      renderable &&
      shouldDisposeParkedRenderable({
        viewportState,
        offscreenPolicy,
        parkedAt: targetState.parkedAtByTargetKey.get(descriptor.key),
        now: frameInput.time,
      })
    ) {
      disposeOffscreenRenderable(targetState, {
        key: descriptor.key,
        renderable,
        restoreFallback: true,
      });
      debugRecord.lifecycleState = "disposed";
      debugRecord.visible = false;
      return true;
    }

    if (renderable && offscreenPolicy.strategy === "park") {
      if (!targetState.parkedAtByTargetKey.has(descriptor.key)) {
        targetState.parkedAtByTargetKey.set(descriptor.key, frameInput.time);
        targetState.parkedVisibilityByTargetKey.set(
          descriptor.key,
          readRenderableVisibilityForPark(targetState, descriptor.key, renderable),
        );
        bumpLifecycleVersion(targetState, descriptor.key);
      }
      renderable.setVisible(false);
      debugRecord.lifecycleState = "paused";
      debugRecord.visible = false;
      return true;
    }

    debugRecord.lifecycleState =
      viewportState === "preloading" ? "preloading" : "inactive";
    return true;
  }

  function ensureRenderableCreated(
    descriptor: TargetDescriptor,
    debugRecord: TargetDebugRecord,
  ): Renderable | null {
    if (targetState.failedTargetKeys.has(descriptor.key)) {
      debugRecord.lifecycleState = "error";
      return null;
    }

    let pipeline: ReturnType<typeof createPipelineRenderable>;

    try {
      pipeline = createPipelineRenderable(
        descriptor,
        renderableFactoryContext,
        targetState,
      );
    } catch (error: unknown) {
      markDebugRecordError(debugRecord, error);
      restoreFallbackVisibility(targetState, descriptor.key);
      targetState.failedTargetKeys.add(descriptor.key);
      if (isGateTarget(descriptor)) {
        releaseActiveGate(scrollState);
      }
      emitDebugState(true);
      throw error;
    }

    const renderable = pipeline.renderable;
    targetState.renderablesByTargetKey.set(descriptor.key, renderable);
    targetState.effectControllersByTargetKey.set(
      descriptor.key,
      pipeline.effectController,
    );
    targetState.debugRecordsByTargetKey.set(descriptor.key, pipeline.debugRecord);
    targetState.fallbackControllersByTargetKey.set(
      descriptor.key,
      createFallbackVisibilityController(
        descriptor.element,
        descriptor.declaration.lifecycle ?? {},
        {
          defaultHideWhenReady: true,
          defaultHideMode: "self",
          key: descriptor.key,
        },
      ),
    );
    targetState.renderables.add(renderable);
    internalOptions.onRenderableCreated?.(renderable);
    return renderable;
  }

  function scheduleAsyncCompletion(
    resultPromise: Promise<void>,
    descriptor: TargetDescriptor,
    renderable: Renderable,
    debugRecord: TargetDebugRecord,
    layoutMeasurement: ElementLayoutSnapshot | undefined,
    lifecycleVersion: number,
    pendingUpdates: Array<Promise<void>>,
    frameInput: WebGLFrameInput,
    requestResourceReadyFrame: boolean,
    effectDirtyReasons: readonly RenderDirtyReason[],
  ): void {
    markDebugRecordLoading(debugRecord);
    restoreFallbackVisibility(targetState, descriptor.key);
    const update = resultPromise
      .then(() => {
        if (isStaleAsyncCompletion(descriptor, renderable, lifecycleVersion)) return;

        if (layoutMeasurement) {
          const currentInput = frameInputSource.getState();
          applyTransformAttachment(descriptor, renderable);
          renderable.updateLayout?.(layoutMeasurement);
          updateTargetEffects(
            descriptor,
            currentInput,
            layoutMeasurement,
            mergeRenderDirtyReasons(effectDirtyReasons, ["resource-ready"]),
          );
          syncTargetTimelineState(descriptor, renderable);
        }
        syncDebugRecordFromRenderable(debugRecord, renderable);
        syncFallbackVisibility(targetState, descriptor, renderable);
        if (requestResourceReadyFrame) {
          rendererLoopRequestFrame("resource-ready");
        }
      })
      .catch((error: unknown) => {
        if (isStaleAsyncReject(descriptor, renderable, lifecycleVersion)) return;

        markDebugRecordError(debugRecord, error);
        restoreFallbackVisibility(targetState, descriptor.key);
        if (isGateTarget(descriptor)) releaseActiveGate(scrollState);
        if (requestResourceReadyFrame) {
          rendererLoopRequestFrame("resource-ready");
        }
        throw error;
      });

    pendingUpdates.push(update);
  }

  function applySyncCompletion(
    descriptor: TargetDescriptor,
    renderable: Renderable,
    debugRecord: TargetDebugRecord,
    layoutMeasurement: ElementLayoutSnapshot | undefined,
    frameInput: WebGLFrameInput,
    effectDirtyReasons: readonly RenderDirtyReason[],
  ): void {
    if (layoutMeasurement) {
      applyTransformAttachment(descriptor, renderable);
      renderable.updateLayout?.(layoutMeasurement);
      updateTargetEffects(
        descriptor,
        frameInput,
        layoutMeasurement,
        effectDirtyReasons,
      );
      syncTargetTimelineState(descriptor, renderable);
    }
    syncDebugRecordFromRenderable(debugRecord, renderable);
    syncFallbackVisibility(targetState, descriptor, renderable);
  }

  function isStaleAsyncCompletion(
    descriptor: TargetDescriptor,
    renderable: Renderable,
    lifecycleVersion: number,
  ): boolean {
    return (
      targetState.renderablesByTargetKey.get(descriptor.key) !== renderable ||
      readLifecycleVersion(targetState, descriptor.key) !== lifecycleVersion ||
      targetState.parkedAtByTargetKey.has(descriptor.key)
    );
  }

  function isStaleAsyncReject(
    descriptor: TargetDescriptor,
    renderable: Renderable,
    lifecycleVersion: number,
  ): boolean {
    if (targetState.renderablesByTargetKey.get(descriptor.key) !== renderable) {
      if (targetState.retiredRenderables.has(renderable)) return true;
      return false;
    }
    return (
      readLifecycleVersion(targetState, descriptor.key) !== lifecycleVersion ||
      targetState.parkedAtByTargetKey.has(descriptor.key)
    );
  }

  function syncFrame(
    dirtyReasons: readonly RenderDirtyReason[] = ["manual-sync"],
  ): SyncFrameResult {
    if (disposed) {
      return { didSynchronousUpdate: false, schedulingMode: "on-demand" };
    }

    syncingFrame = true;
    try {
      const descriptors = listTargetsInScanOrder(registry);
      const frameInput = frameInputSource.update();
      const progressSignals = readProgressSignals();
      let requiresContinuousRendering = frameInput.scroll.mode === "gate";

      layoutScrollOffset += frameInput.scroll.velocity;
      syncTargetLayerOrdering(descriptors);
      rendererHost.resizeIfNeeded();
      renderLayers.resize(rendererHost.getViewportSize());
      renderLayers.updateTimelineState(progressSignals);
      stageObjects.updateTimelineState(progressSignals);
      const cameraControllerChanged =
        renderLayers.updateCameraControllers(progressSignals);
      const interactionResult = updateSceneObjectInteractions(frameInput);
      const cameraGestureUpdate = renderLayers.updateCameraGestureControllers({
        frameInput,
        blocked: isCameraPointerBlocked(interactionResult.debug),
        passes: readManagedCameraGesturePasses(),
      });
      cameraInteractionSummary = cameraGestureUpdate.summary;
      const stageEffectsContinuous = stageObjects.updateEffects(frameInput);
      const dirtyKeys = invalidationController.consumeDirtyKeys();

      const layoutMeasurements = measureTargetLayouts(descriptors, dirtyKeys);
      syncTransformGroups(descriptors, layoutMeasurements);

      const pendingUpdates: Array<Promise<void>> = [];
      let didSynchronousUpdate =
        cameraControllerChanged ||
        cameraGestureUpdate.changed ||
        stageEffectsContinuous ||
        !interactionResult.emptySpace;
      const viewportHeight = window.innerHeight || 600;
      let modelPreparePasses: ModelPreparePass[] | undefined;
      const modelUpdate = managedModels.update(frameInput, progressSignals, {
        canLoadPreparedModel(request) {
          modelPreparePasses ??= readModelPreparePasses();
          return readModelPrepareDecision({
            sceneId: request.sceneId,
            viewportHeight,
            passes: modelPreparePasses,
          }).allowed;
        },
      });

      if (isPromiseLike(modelUpdate)) {
        pendingUpdates.push(
          Promise.resolve(modelUpdate).then(() => {
            rendererLoopRequestFrame("resource-ready");
          }),
        );
      } else if (modelUpdate) {
        requiresContinuousRendering = true;
      }
      requiresContinuousRendering =
        requiresContinuousRendering ||
        stageEffectsContinuous ||
        cameraGestureUpdate.summary?.active === true ||
        cameraGestureUpdate.requiresContinuousRendering ||
        !interactionResult.emptySpace;

      for (const descriptor of descriptors) {
        let debugRecord = readTargetDebugRecord(descriptor, targetState);
        const layoutMeasurement = layoutMeasurements.get(descriptor.key);

        if (!layoutMeasurement) {
          // Pre-filter skipped this target — kept as disposed via scroll estimation.
          delete debugRecord.pointer;
          const prev = rectSkipState.get(descriptor.key);
          if (prev) {
            prev.skippedFrames += 1;
          }
          const renderable = targetState.renderablesByTargetKey.get(
            descriptor.key,
          );
          reconcileOffscreenTarget(
            "disposed",
            descriptor,
            renderable,
            frameInput,
            readTargetDebugRecord(descriptor, targetState),
          );
          continue;
        }

        const viewportState = viewportLifecycle.classify(
          layoutMeasurement,
          viewportHeight,
        );

        if (viewportState === "disposed") {
          rectSkipState.set(descriptor.key, {
            lastTop: layoutMeasurement.top,
            layoutScrollOffset,
            viewport: layoutMeasurement.viewport,
            frames: (rectSkipState.get(descriptor.key)?.frames ?? 0) + 1,
            skippedFrames: 0,
          });
        } else {
          rectSkipState.delete(descriptor.key);
        }

        let renderable = targetState.renderablesByTargetKey.get(descriptor.key);

        if (viewportState !== "active") {
          delete debugRecord.pointer;
          const skipped = reconcileOffscreenTarget(
            viewportState,
            descriptor,
            renderable,
            frameInput,
            debugRecord,
          );
          if (skipped) {
            continue;
          }
        }

        const wasParked = targetState.parkedAtByTargetKey.delete(
          descriptor.key,
        );
        if (wasParked) {
          renderable?.setVisible(
            targetState.parkedVisibilityByTargetKey.get(descriptor.key) ?? true,
          );
          targetState.parkedVisibilityByTargetKey.delete(descriptor.key);
        }

        if (!renderable) {
          const created = ensureRenderableCreated(descriptor, debugRecord);
          if (!created) {
            continue;
          }
          renderable = created;
          debugRecord = readTargetDebugRecord(descriptor, targetState);
        }

        applyCurrentSceneOrdering(descriptor, renderable);
        if (shouldKeepTargetContinuous(descriptor, renderable)) {
          requiresContinuousRendering = true;
        }

        if (dirtyKeys.has(descriptor.key)) {
          renderable.invalidateContent?.();
        }

        const lifecycleVersion = readLifecycleVersion(
          targetState,
          descriptor.key,
        );
        const requestResourceReadyFrame = renderable.status === "idle";
        const effectDirtyReasons = readTargetEffectDirtyReasons(
          descriptor,
          layoutMeasurement,
          dirtyKeys,
          dirtyReasons,
          frameInput,
        );
        syncTargetPointerDebugRecord(
          descriptor,
          debugRecord,
          frameInput,
          layoutMeasurement,
        );
        let result: void | Promise<void>;
        const previousResourceLoadPriority = currentResourceLoadPriority;

        currentResourceLoadPriority = readViewportResourceLoadPriority(
          viewportState,
        );
        try {
          result = renderable.update(frameInput);
          layoutCacheKeysByTargetKey.set(
            descriptor.key,
            layoutMeasurement.layoutSignature,
          );
        } catch (error: unknown) {
          markDebugRecordError(debugRecord, error);
          restoreFallbackVisibility(targetState, descriptor.key);
          if (isGateTarget(descriptor)) {
            releaseActiveGate(scrollState);
          }
          emitDebugState(true);
          throw error;
        } finally {
          currentResourceLoadPriority = previousResourceLoadPriority;
        }

        if (isPromiseLike(result)) {
          scheduleAsyncCompletion(
            result,
            descriptor,
            renderable,
            debugRecord,
            layoutMeasurement,
            lifecycleVersion,
            pendingUpdates,
            frameInput,
            requestResourceReadyFrame,
            effectDirtyReasons,
          );
        } else {
          applySyncCompletion(
            descriptor,
            renderable,
            debugRecord,
            layoutMeasurement,
            frameInput,
            effectDirtyReasons,
          );
          didSynchronousUpdate = true;
        }
      }

      emitDebugState();

      if (pendingUpdates.length === 0) {
        return {
          didSynchronousUpdate,
          schedulingMode: requiresContinuousRendering
            ? "continuous"
            : "on-demand",
        };
      }

      const pendingUpdate = Promise.all(pendingUpdates).then(
        () => {
          emitDebugState(true);
        },
        (error: unknown) => {
          emitDebugState(true);
          throw error;
        },
      );

      return {
        didSynchronousUpdate,
        schedulingMode: requiresContinuousRendering
          ? "continuous"
          : "on-demand",
        pendingUpdate,
      };
    } finally {
      syncingFrame = false;
    }
  }

  function updateTargetEffects(
    descriptor: TargetDescriptor,
    frameInput: WebGLFrameInput,
    layoutMeasurement: ElementLayoutSnapshot,
    dirtyReasons: readonly RenderDirtyReason[],
  ): void {
    const effectController = targetState.effectControllersByTargetKey.get(
      descriptor.key,
    );
    if (!effectController?.needsUpdate(frameInput, dirtyReasons)) {
      return;
    }

    effectController.update(frameInput, layoutMeasurement);
  }

  function readTargetEffectDirtyReasons(
    descriptor: TargetDescriptor,
    layoutMeasurement: ElementLayoutSnapshot,
    dirtyKeys: ReadonlySet<string>,
    frameDirtyReasons: readonly RenderDirtyReason[],
    frameInput: WebGLFrameInput,
  ): readonly RenderDirtyReason[] {
    const reasons = new Set<RenderDirtyReason>();

    for (const reason of frameDirtyReasons) {
      switch (reason) {
        case "initial":
        case "target-register":
        case "target-unregister":
        case "manual-sync":
          reasons.add(reason);
          break;
        case "dom-invalidation":
        case "resource-ready":
        case "layout":
        case "pointer":
        case "scroll":
          break;
      }
    }

    if (dirtyKeys.has(descriptor.key)) {
      reasons.add("dom-invalidation");
    }

    const previousLayoutCacheKey = layoutCacheKeysByTargetKey.get(descriptor.key);
    const nextLayoutCacheKey = layoutMeasurement.layoutSignature;

    if (previousLayoutCacheKey !== nextLayoutCacheKey) {
      reasons.add("layout");
    }

    if (hasPointerDeclaration(descriptor.declaration.pointer)) {
      reasons.add("pointer");
    }

    if (frameInput.scroll.velocity !== 0 || frameInput.scroll.mode === "gate") {
      reasons.add("scroll");
    }

    return Array.from(reasons);
  }

  function syncTargetPointerDebugRecord(
    descriptor: TargetDescriptor,
    debugRecord: TargetDebugRecord,
    frameInput: WebGLFrameInput,
    layoutMeasurement: ElementLayoutSnapshot,
  ): void {
    if (hasPointerDeclaration(descriptor.declaration.pointer)) {
      debugRecord.pointer = createTargetPointerState(frameInput, layoutMeasurement);
      return;
    }

    delete debugRecord.pointer;
  }

  function mergeRenderDirtyReasons(
    current: readonly RenderDirtyReason[],
    additional: readonly RenderDirtyReason[],
  ): readonly RenderDirtyReason[] {
    return Array.from(new Set([...current, ...additional]));
  }

  function handleVisibilityChange(): void {
    if (disposed || ownerDocument.visibilityState !== "hidden") {
      return;
    }

    releaseActiveGate(scrollState);
    emitDebugState(true);
  }

  // Placeholder for future WebGLRuntimeOptions.viewportLifecycle margin overrides

  function syncTargetLayerOrdering(descriptors: TargetDescriptor[]): void {
    const targetTree = createTargetLayerTree(descriptors);

    for (const descriptor of descriptors) {
      const layer = targetTree.recordsByKey.get(descriptor.key);

      if (!layer) {
        continue;
      }

      const source = inferSourceDescriptor(descriptor);
      const role = inferRenderRole(source, descriptor.declaration);
      const policy = compileRenderPolicy(role);

      targetState.targetLayersByTargetKey.set(descriptor.key, layer);
      targetState.orderingsByTargetKey.set(
        descriptor.key,
        toScopedSceneObjectOrdering(policy, layer),
      );
      targetState.managedOrderingsByTargetKey.set(
        descriptor.key,
        toScopedManagedObjectOrdering(layer),
      );
    }
  }

  function applyCurrentSceneOrdering(
    descriptor: TargetDescriptor,
    renderable: Renderable,
  ): void {
    const ordering = targetState.orderingsByTargetKey.get(descriptor.key);

    if (!ordering) {
      return;
    }

    const setOrdering = renderable.sceneObjectController?.setOrdering;
    setOrdering?.(ordering);
  }

  function syncTransformGroups(
    descriptors: readonly TargetDescriptor[],
    layoutMeasurements: ReadonlyMap<string, ElementLayoutSnapshot>,
  ): void {
    const projectedLayoutsByKey = new Map<string, ProjectedDOMRect>();
    const descriptorsByKey = new Map(
      descriptors.map((descriptor) => [descriptor.key, descriptor]),
    );

    for (const [key, measurement] of layoutMeasurements) {
      const descriptor = descriptorsByKey.get(key);
      if (!descriptor) {
        continue;
      }

      projectedLayoutsByKey.set(
        key,
        projectTargetLayoutForDescriptor(descriptor, measurement, measurement.viewport),
      );
    }

    const plan = createTransformGroupPlan({
      descriptors,
      layersByKey: targetState.targetLayersByTargetKey,
      layoutsByKey: projectedLayoutsByKey,
    });

    reconcileTransformGroups(plan.groupsByKey, descriptorsByKey);
    transformProjectedLayoutsByTargetKey.clear();
    transformAttachmentGroupByTargetKey.clear();

    for (const descriptor of descriptors) {
      const projectedLayout = projectedLayoutsByKey.get(descriptor.key);
      const attachment = plan.attachmentsByKey.get(descriptor.key);

      if (!projectedLayout) {
        continue;
      }

      const group = attachment?.groupKey
        ? readTransformGroupStateForDescriptor(attachment.groupKey, descriptor)
        : undefined;

      if (attachment?.groupKey && group) {
        transformProjectedLayoutsByTargetKey.set(
          descriptor.key,
          attachment.layout,
        );
        transformAttachmentGroupByTargetKey.set(
          descriptor.key,
          attachment.groupKey,
        );
        continue;
      }

      transformProjectedLayoutsByTargetKey.set(
        descriptor.key,
        attachment?.groupKey ? projectedLayout : attachment?.layout ?? projectedLayout,
      );
      transformAttachmentGroupByTargetKey.set(descriptor.key, undefined);
    }
  }

  function readSceneAdapterForTarget(
    descriptor: TargetDescriptor,
  ): WebGLSceneAdapter {
    return renderLayers.getSceneAdapterForTarget(descriptor.declaration.sceneId);
  }

  function readProgressSignals(): WebGLProgressSignalSource {
    return options.progressSignals ?? emptyProgressSignals;
  }

  function readRuntimeEffectScopes(
    descriptor: TargetDescriptor,
  ): WebGLEffectScopeSnapshot {
    const sceneId = normalizeTargetSceneId(descriptor.declaration.sceneId);
    const scene = renderLayers.getScene(sceneId);

    return createWebGLEffectScopeSnapshot({
      progressSignals: readProgressSignals(),
      scene: {
        id: scene.id,
        projection: scene.projection,
        ...(scene.timeline ? { timeline: scene.timeline } : {}),
      },
    });
  }

  function readSceneObjectEffectScopes(sceneId: string): WebGLEffectScopeSnapshot {
    const scene = renderLayers.getScene(sceneId);

    return createWebGLEffectScopeSnapshot({
      progressSignals: readProgressSignals(),
      scene: {
        id: scene.id,
        projection: scene.projection,
        ...(scene.timeline ? { timeline: scene.timeline } : {}),
      },
    });
  }

  function syncTargetTimelineState(
    descriptor: TargetDescriptor,
    renderable: Renderable,
  ): void {
    const timeline = descriptor.declaration.timeline;
    if (!timeline?.active) {
      targetState.timelineActiveByTargetKey.delete(descriptor.key);
      return;
    }

    const snapshot = readTimelineProgress(timeline, readProgressSignals());
    targetState.timelineActiveByTargetKey.set(descriptor.key, snapshot.active);
    renderable.setVisible(
      readEffectiveTargetVisibility(targetState, descriptor.key),
    );
  }

  function projectTargetLayoutForDescriptor(
    descriptor: TargetDescriptor,
    measurement: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
    viewport: DOMViewportSize,
  ): ProjectedDOMRect {
    const sceneId = normalizeTargetSceneId(descriptor.declaration.sceneId);
    const scene = renderLayers.getScene(sceneId);
    const camera = renderLayers.getCamera(
      scene.defaultCameraId ?? generatedRenderLayerId,
    );

    return projectTargetLayout({
      sceneProjection: scene.projection,
      camera,
      placement: normalizeTargetPlacement(descriptor.declaration.placement),
      measurement,
      viewport,
      screenPlane: {
        resolvePlane(planeId) {
          return stageObjects.readStagePlane(planeId, sceneId);
        },
      },
    });
  }

  function readTransformGroupStateForDescriptor(
    groupKey: string,
    descriptor: TargetDescriptor,
  ): RuntimeTransformGroupState | undefined {
    const state = transformGroupsByKey.get(groupKey);

    if (!state || state.sceneAdapter !== readSceneAdapterForTarget(descriptor)) {
      return undefined;
    }

    return state;
  }

  function reconcileTransformGroups(
    nextGroupsByKey: ReadonlyMap<
      string,
      { key: string; parentGroupKey: string | undefined; layout: ProjectedDOMRect }
    >,
    descriptorsByKey: ReadonlyMap<string, TargetDescriptor>,
  ): void {
    const nextKeys = new Set(nextGroupsByKey.keys());
    for (const key of Array.from(transformGroupsByKey.keys())) {
      if (!nextKeys.has(key)) {
        removeTransformGroup(key);
      }
    }

    const groupRecords = Array.from(nextGroupsByKey.values()).sort(
      (left, right) => readTargetLayerDepth(left.key) - readTargetLayerDepth(right.key),
    );

    for (const record of groupRecords) {
      const descriptor = descriptorsByKey.get(record.key);

      if (!descriptor) {
        continue;
      }

      const sceneAdapter = readSceneAdapterForTarget(descriptor);
      if (!sceneAdapter.createGroup || !sceneAdapter.addGroup) {
        removeTransformGroup(record.key);
        continue;
      }

      const parentState = record.parentGroupKey
        ? transformGroupsByKey.get(record.parentGroupKey)
        : undefined;
      const parentGroup =
        parentState?.sceneAdapter === sceneAdapter ? parentState.group : undefined;
      let state = transformGroupsByKey.get(record.key);

      if (state && state.sceneAdapter !== sceneAdapter) {
        removeTransformGroup(record.key);
        state = undefined;
      }

      if (!state) {
        const group = sceneAdapter.createGroup(record.key);
        sceneAdapter.addGroup(group, parentGroup);
        state = { sceneAdapter, group };
        transformGroupsByKey.set(record.key, state);
      } else {
        sceneAdapter.setGroupParent?.(state.group, parentGroup);
      }

      updateTransformGroupPosition(state.group.object3D, record.layout);
    }
  }

  function updateTransformGroupPosition(
    object3D: unknown,
    layout: ProjectedDOMRect,
  ): void {
    if (!object3D || typeof object3D !== "object") {
      return;
    }

    setVector3(
      (object3D as { position?: unknown }).position,
      layout.x,
      layout.y,
      layout.z ?? 0,
    );
  }

  function setVector3(
    value: unknown,
    x: number,
    y: number,
    z: number,
  ): void {
    if (!value || typeof value !== "object") {
      return;
    }

    const vector = value as {
      set?: (x: number, y: number, z: number) => void;
      x?: number;
      y?: number;
      z?: number;
    };

    if (typeof vector.set === "function") {
      vector.set(x, y, z);
      return;
    }

    vector.x = x;
    vector.y = y;
    vector.z = z;
  }

  function applyTransformAttachment(
    descriptor: TargetDescriptor,
    renderable: Renderable,
  ): void {
    const sceneObject = renderable.sceneObjectController?.object;

    if (!sceneObject) {
      return;
    }

    const groupKey = transformAttachmentGroupByTargetKey.get(descriptor.key);
    const group = groupKey
      ? readTransformGroupStateForDescriptor(groupKey, descriptor)?.group
      : undefined;

    readSceneAdapterForTarget(descriptor).setObjectParent?.(sceneObject, group);
  }

  function readRuntimeEffectTarget(
    descriptor: TargetDescriptor,
    renderable: Renderable,
  ): WebGLEffectTarget | undefined {
    if (descriptor.declaration.transformScope !== "subtree") {
      return renderable.effectTarget;
    }

    const state = transformGroupsByKey.get(descriptor.key);
    if (!state) {
      return renderable.effectTarget;
    }

    if (
      state.effectTargetObject3D !== state.group.object3D ||
      !state.effectTarget
    ) {
      state.effectTargetObject3D = state.group.object3D;
      state.effectTarget = createObject3DEffectTarget(
        state.group.object3D,
        renderable.effectTarget?.addObject3D,
      );
    }

    return state.effectTarget ?? renderable.effectTarget;
  }

  function removeTransformGroup(key: string): void {
    const state = transformGroupsByKey.get(key);

    if (!state) {
      return;
    }

    state.sceneAdapter.removeGroup?.(state.group);
    transformGroupsByKey.delete(key);
  }

  function removeAllTransformGroups(): void {
    for (const key of Array.from(transformGroupsByKey.keys())) {
      removeTransformGroup(key);
    }
  }

  function readTargetLayerDepth(key: string): number {
    return targetState.targetLayersByTargetKey.get(key)?.depth ?? 0;
  }

  function shouldKeepTargetContinuous(
    descriptor: TargetDescriptor,
    renderable: Renderable,
  ): boolean {
    const source = inferSourceDescriptor(descriptor);

    if (renderable.shouldRenderContinuously?.()) {
      return true;
    }

    if (source.kind === "media" && source.type === "video") {
      return true;
    }

    if (isGateTarget(descriptor)) {
      return true;
    }

    return (
      targetState.effectControllersByTargetKey.get(descriptor.key)
        ?.schedulingMode === "frame" && renderable.status !== "disposed"
    );
  }

  function hasPointerDrivenTarget(): boolean {
    return (
      listTargetsInScanOrder(registry).some((descriptor) =>
        hasPointerDeclaration(descriptor.declaration.pointer),
      ) ||
      stageObjects.collectHitCandidates().length > 0 ||
      managedModels.collectHitCandidates().length > 0
    );
  }

  function hasPointerDeclaration(
    pointer: WebGLDeclaration["pointer"],
  ): boolean {
    return (
      pointer?.hover === true ||
      pointer?.press === true ||
      pointer?.click === true ||
      pointer?.drag === true
    );
  }

  function unregisterTargetsForScene(sceneId: string): void {
    for (const descriptor of listTargetsInScanOrder(registry)) {
      if (descriptor.declaration.sceneId?.trim() === sceneId) {
        unregisterRuntimeTarget(descriptor.key);
      }
    }
  }

  function unregisterRuntimeTarget(key: string): void {
    const targetKey = key.trim();
    const descriptor = registry.get(targetKey);

    registry.unregister(targetKey);
    rectSkipState.delete(targetKey);
    invalidationController.unobserveTarget(targetKey);
    unregisterGateTarget(scrollState, descriptor);
    layoutCacheKeysByTargetKey.delete(targetKey);
    transformProjectedLayoutsByTargetKey.delete(targetKey);
    transformAttachmentGroupByTargetKey.delete(targetKey);
    restoreFallbackVisibility(targetState, targetKey);
    targetState.fallbackControllersByTargetKey.delete(targetKey);
    disposeTargetRenderable(targetState, targetKey);
    removeTransformGroup(targetKey);
    unmarkFallbackRoot(targetKey);
  }

  function unmarkFallbackRoot(key: string): void {
    fallbackRootUnmarkersByTargetKey.get(key)?.();
    fallbackRootUnmarkersByTargetKey.delete(key);
  }

  function unmarkAllFallbackRoots(): void {
    for (const unmark of fallbackRootUnmarkersByTargetKey.values()) {
      unmark();
    }

    fallbackRootUnmarkersByTargetKey.clear();
  }
}

function readDebugScrollState(
  scroll: WebGLFrameInput["scroll"],
): Pick<
  DebugRuntimeState,
  "currentScrollMode" | "activeGateKey" | "sceneProgress"
> {
  if (scroll.mode === "gate") {
    return {
      currentScrollMode: "gate",
      activeGateKey: scroll.activeGateKey,
      sceneProgress: scroll.sceneProgress,
    };
  }

  return { currentScrollMode: "page" };
}

function createPipelineRenderable(
  descriptor: TargetDescriptor,
  context: PipelineRenderableContext,
  targetState: TargetRuntimeState,
): {
  renderable: Renderable;
  effectController: WebGLEffectController;
  debugRecord: TargetDebugRecord;
} {
  const source = inferSourceDescriptor(descriptor);
  const role = inferRenderRole(source, descriptor.declaration);
  const policy = compileRenderPolicy(role);
  const debugRecord: TargetDebugRecord = {
    sourceKind: readSourceKind(source),
    renderRole: role,
    resourceStatus: "idle",
    lifecycleState: "declared",
    visible: true,
  };
  const renderable = createRenderable(descriptor, source, role, policy, context);
  let rawEffectTarget: WebGLEffectTarget | undefined;
  let trackedEffectTarget: WebGLEffectTarget | undefined;
  const effectController = createWebGLEffectController({
    key: descriptor.key,
    declaration: descriptor.declaration.effects,
    source,
    getSource: () => renderable.effectSource,
    getTarget: () => {
      const target =
        context.getEffectTarget?.(descriptor, renderable) ??
        renderable.effectTarget;

      if (!target) {
        rawEffectTarget = undefined;
        trackedEffectTarget = undefined;
        return undefined;
      }

      if (target !== rawEffectTarget || !trackedEffectTarget) {
        rawEffectTarget = target;
        trackedEffectTarget = createTrackedEffectTarget(
          targetState,
          descriptor.key,
          target,
        );
      }

      return trackedEffectTarget;
    },
    registry: context.effectRegistry,
    progressSignals: context.progressSignals,
    readScopes: () =>
      context.readEffectScopes?.(descriptor) ??
      createWebGLEffectScopeSnapshot({
        progressSignals:
          context.progressSignals ??
          {
            get() {
              return 0;
            },
          },
      }),
    visual: context.postprocessController,
    createLights: createManagedLightsFacade,
  });

  return {
    renderable: attachDebugBookkeeping(renderable, debugRecord),
    effectController,
    debugRecord,
  };
}

function readTargetDebugRecord(
  descriptor: TargetDescriptor,
  targetState: TargetRuntimeState,
): TargetDebugRecord {
  const existing = targetState.debugRecordsByTargetKey.get(descriptor.key);

  if (existing) {
    return existing;
  }

  const source = inferSourceDescriptor(descriptor);
  const record: TargetDebugRecord = {
    sourceKind: readSourceKind(source),
    renderRole: inferRenderRole(source, descriptor.declaration),
    resourceStatus: "idle",
    lifecycleState: "declared",
    visible: true,
  };

  targetState.debugRecordsByTargetKey.set(descriptor.key, record);

  return record;
}

function readSourceKind(source: ReturnType<typeof inferSourceDescriptor>): string {
  return `${source.kind}/${source.type}`;
}

function attachDebugBookkeeping(
  renderable: Renderable,
  debugRecord: TargetDebugRecord,
): Renderable {
  const setVisible = renderable.setVisible.bind(renderable);
  const dispose = renderable.dispose.bind(renderable);

  renderable.setVisible = (visible) => {
    debugRecord.visible = visible;
    setVisible(visible);
  };
  renderable.dispose = () => {
    debugRecord.visible = false;
    debugRecord.lifecycleState = "disposed";
    dispose();
    syncDebugRecordFromRenderable(debugRecord, renderable);
  };

  return renderable;
}

function syncDebugRecordFromRenderable(
  debugRecord: TargetDebugRecord,
  renderable: Renderable,
): void {
  debugRecord.resourceStatus = readRenderableResourceStatus(renderable);
  debugRecord.lifecycleState = readRenderableLifecycleState(renderable);
  debugRecord.visible = readRenderableSceneVisibility(renderable);

  if (renderable.status !== "error") {
    delete debugRecord.error;
  }
}

function shouldDisposeParkedRenderable(input: {
  viewportState: ViewportLifecycleState;
  offscreenPolicy: ReturnType<typeof compileOffscreenPolicy>;
  parkedAt: number | undefined;
  now: number;
}): boolean {
  if (input.viewportState === "disposed") {
    return true;
  }

  if (input.offscreenPolicy.strategy !== "park") {
    return false;
  }

  if (input.offscreenPolicy.warmTtlMs <= 0) {
    return false;
  }

  if (input.parkedAt === undefined) {
    return false;
  }

  return input.now - input.parkedAt >= input.offscreenPolicy.warmTtlMs;
}

function readRenderableSceneVisibility(renderable: Renderable): boolean {
  const controller = renderable.sceneObjectController;

  if (controller) {
    return controller.attached && controller.visible;
  }

  return renderable.status !== "disposed";
}

function markDebugRecordError(
  debugRecord: TargetDebugRecord,
  error: unknown,
): void {
  debugRecord.resourceStatus = "error";
  debugRecord.lifecycleState = "error";
  debugRecord.error = error;
}

function markDebugRecordLoading(debugRecord: TargetDebugRecord): void {
  debugRecord.resourceStatus = "loading";
  debugRecord.lifecycleState = "preloading";
  delete debugRecord.error;
}

function readRenderableResourceStatus(
  renderable: Renderable,
): WebGLResourceStatus {
  switch (renderable.status) {
    case "ready":
      return "ready";
    case "error":
      return "error";
    case "idle":
    case "disposed":
      return "idle";
  }
}

function readRenderableLifecycleState(renderable: Renderable): WebGLLifecycleState {
  switch (renderable.status) {
    case "ready":
      return renderable.sceneObjectController?.visible === false
        ? "inactive"
        : "active";
    case "error":
      return "error";
    case "disposed":
      return "disposed";
    case "idle":
      return "mounted";
  }
}

function listTargetsInScanOrder(registry: TargetRegistry): TargetDescriptor[] {
  return registry.list().sort((left, right) => left.scanOrder - right.scanOrder);
}

function isGateTarget(descriptor: TargetDescriptor): boolean {
  return descriptor.declaration.scroll?.type === "gate";
}

function registerGateTarget(
  scrollState: RuntimeScrollController,
  descriptor: TargetDescriptor,
): void {
  const scroll = descriptor.declaration.scroll;

  if (scroll?.type !== "gate") {
    return;
  }

  scrollState.registerGateTarget?.({
    key: descriptor.key,
    scroll,
    getRect: () => descriptor.element.getBoundingClientRect(),
  });
}

function unregisterGateTarget(
  scrollState: RuntimeScrollController,
  descriptor: TargetDescriptor | undefined,
): void {
  if (descriptor?.declaration.scroll?.type !== "gate") {
    return;
  }

  const scroll = scrollState.getState();

  if (scroll.mode === "gate" && scroll.activeGateKey === descriptor.key) {
    releaseActiveGate(scrollState);
  }

  scrollState.unregisterGateTarget?.(descriptor.key);
}

function releaseActiveGate(scrollState: RuntimeScrollController): void {
  scrollState.releaseActiveGate?.();
}

function measureElement(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect();
}

function readViewportSize(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function readPageScrollMetrics(): WebGLScrollMetrics {
  const documentElement = document.documentElement;

  return {
    scrollY: window.scrollY,
    scrollHeight: Math.max(
      documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
    ),
    viewportHeight: window.innerHeight,
  };
}

function readClock(): number {
  return performance.now();
}

function isPromiseLike<T>(result: T | Promise<T>): result is Promise<T> {
  return Boolean(
    result &&
      typeof result === "object" &&
      "then" in result &&
      typeof result.then === "function",
  );
}

function assertBrowserDOMAvailable(): void {
  const globals = globalThis as BrowserDOMGlobals;

  if (
    typeof globals.window === "undefined" ||
    typeof globals.document === "undefined" ||
    typeof globals.document.createElement !== "function"
  ) {
    throw new Error(missingDOMMessage);
  }
}
