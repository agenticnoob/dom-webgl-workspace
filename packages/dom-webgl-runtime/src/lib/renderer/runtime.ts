import {
  createDebugState,
  type DebugRuntimeState,
} from "../debug/debugState";
import type {
  WebGLDebugState,
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
import { compileRenderPolicy, toSceneObjectOrdering } from "../render/renderPolicy";
import {
  toScopedManagedObjectOrdering,
  toScopedSceneObjectOrdering,
} from "../render/layerOrdering";
import { inferRenderRole } from "../render/renderRole";
import { createResourceManager } from "../resources/resourceManager";
import { inferSourceDescriptor } from "../source/inferSource";
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
  readLifecycleVersion,
  readRenderableVisibilityForPark,
  restoreFallbackVisibility,
  syncFallbackVisibility,
  type DisposableRenderable,
  type TargetDebugRecord,
  type TargetRuntimeState,
} from "./targetRuntimeState";

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
};

type SyncFrameResult = {
  didSynchronousUpdate: boolean;
  schedulingMode: RenderSchedulingMode;
  pendingUpdate?: Promise<void>;
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
  const registry = createTargetRegistry();
  const resourceManager = createResourceManager(options.performanceBudget);
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
      scene: rendererHost.scene,
      camera: rendererHost.camera,
      getViewportSize: () => rendererHost.getViewportSize(),
    });
  const targetState = createTargetRuntimeState(
    internalOptions.renderables ?? [],
  );
  const fallbackRootUnmarkersByTargetKey = new Map<string, () => void>();
  // Created once at init. Margins stay with the lifecycle object;
  // viewportHeight is refreshed each frame through classify().
  // Future: allow margin overrides via WebGLRuntimeOptions.
  const viewportLifecycle = createViewportLifecycle();
  const renderableFactoryContext: PipelineRenderableContext = {
    resourceManager,
    sceneAdapter: rendererHost.sceneAdapter,
    measureElement: internalOptions.measureElement ?? measureElement,
    getViewportSize: () => rendererHost.getViewportSize(),
    loadVideo: internalOptions.loadVideo,
    loadModel: internalOptions.loadModel,
    effectRegistry: createWebGLEffectRegistry(options.effects ?? []),
    progressSignals: options.progressSignals,
    postprocessController,
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
  };
  let nextScanOrder = 0;
  let disposed = false;
  let lastDebugEmit = 0;

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
  let layoutScrollOffset = 0;

  const rendererLoop = createRendererLoop({
    renderer: rendererHost.renderer,
    beforeRender() {
      try {
        const result = syncFrame();
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
      const targetKey = key.trim();
      const descriptor = registry.get(targetKey);

      registry.unregister(targetKey);
      rectSkipState.delete(targetKey);
      invalidationController.unobserveTarget(targetKey);
      unregisterGateTarget(scrollState, descriptor);
      restoreFallbackVisibility(targetState, targetKey);
      targetState.fallbackControllersByTargetKey.delete(targetKey);
      disposeTargetRenderable(targetState, targetKey);
      unmarkFallbackRoot(targetKey);
      rendererLoopRequestFrame("target-unregister");
      emitDebugState(true);
    },
    sync() {
      if (disposed) {
        return;
      }

      const result = syncFrame();

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
        rectSkipState.clear();
        releaseActiveGate(scrollState);
        scrollState.dispose?.();
        pointerController.dispose();
        rendererLoop.dispose();
        postprocessController.dispose();
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

    if (disposed) {
      return createDebugState({
        targetCount: 0,
        renderableCount: 0,
        ...readDebugScrollState(scroll),
        pointer: frameInput.pointer,
        performanceBudget: options.performanceBudget,
        targets: [],
      });
    }

    return createDebugState({
      targetCount: descriptors.length,
      renderableCount: targetState.renderablesByTargetKey.size,
      ...readDebugScrollState(scroll),
      pointer: frameInput.pointer,
      performanceBudget: options.performanceBudget,
      targets: descriptors.map((descriptor) => {
        const layer = targetState.targetLayersByTargetKey.get(descriptor.key);
        const ordering = targetState.orderingsByTargetKey.get(descriptor.key);

        return {
          key: descriptor.key,
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

    postprocessController.render(() => {
      rendererHost.sceneAdapter.render();
    });
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
  ): void {
    markDebugRecordLoading(debugRecord);
    restoreFallbackVisibility(targetState, descriptor.key);
    const update = resultPromise
      .then(() => {
        if (isStaleAsyncCompletion(descriptor, renderable, lifecycleVersion)) return;

        if (layoutMeasurement) {
          const currentInput = frameInputSource.getState();
          renderable.updateLayout?.(layoutMeasurement);
          targetState.effectControllersByTargetKey
            .get(descriptor.key)
            ?.update(currentInput, layoutMeasurement);
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
  ): void {
    if (layoutMeasurement) {
      renderable.updateLayout?.(layoutMeasurement);
      targetState.effectControllersByTargetKey
        .get(descriptor.key)
        ?.update(frameInput, layoutMeasurement);
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

  function syncFrame(): SyncFrameResult {
    if (disposed) {
      return { didSynchronousUpdate: false, schedulingMode: "on-demand" };
    }

    const descriptors = listTargetsInScanOrder(registry);
    const frameInput = frameInputSource.update();
    let requiresContinuousRendering = frameInput.scroll.mode === "gate";

    layoutScrollOffset += frameInput.scroll.velocity;
    syncTargetLayerOrdering(descriptors);
    rendererHost.resizeIfNeeded();
    const dirtyKeys = invalidationController.consumeDirtyKeys();

    const layoutMeasurements = measureTargetLayouts(descriptors, dirtyKeys);

    const pendingUpdates: Array<Promise<void>> = [];
    let didSynchronousUpdate = false;
    const viewportHeight = window.innerHeight || 600;

    for (const descriptor of descriptors) {
      let debugRecord = readTargetDebugRecord(descriptor, targetState);
      const layoutMeasurement = layoutMeasurements.get(descriptor.key);

      if (!layoutMeasurement) {
        // Pre-filter skipped this target — kept as disposed via scroll estimation.
        const prev = rectSkipState.get(descriptor.key);
        if (prev) {
          prev.skippedFrames += 1;
        }
        const renderable = targetState.renderablesByTargetKey.get(descriptor.key);
        reconcileOffscreenTarget(
          "disposed",
          descriptor,
          renderable,
          frameInput,
          readTargetDebugRecord(descriptor, targetState),
        );
        continue;
      }

      const viewportState = viewportLifecycle.classify(layoutMeasurement, viewportHeight);

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
        const skipped = reconcileOffscreenTarget(
          viewportState, descriptor, renderable, frameInput, debugRecord,
        );
        if (skipped) continue;
      }

      const wasParked = targetState.parkedAtByTargetKey.delete(descriptor.key);
      if (wasParked) {
        renderable?.setVisible(
          targetState.parkedVisibilityByTargetKey.get(descriptor.key) ?? true,
        );
        targetState.parkedVisibilityByTargetKey.delete(descriptor.key);
      }

      if (!renderable) {
        const created = ensureRenderableCreated(descriptor, debugRecord);
        if (!created) continue;
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

      const lifecycleVersion = readLifecycleVersion(targetState, descriptor.key);
      const requestResourceReadyFrame = renderable.status === "idle";
      let result: void | Promise<void>;

      try {
        result = renderable.update(frameInput);
      } catch (error: unknown) {
        markDebugRecordError(debugRecord, error);
        restoreFallbackVisibility(targetState, descriptor.key);
        if (isGateTarget(descriptor)) {
          releaseActiveGate(scrollState);
        }
        emitDebugState(true);
        throw error;
      }

      if (isPromiseLike(result)) {
        scheduleAsyncCompletion(result, descriptor, renderable, debugRecord,
          layoutMeasurement, lifecycleVersion, pendingUpdates,
          frameInput, requestResourceReadyFrame);
      } else {
        applySyncCompletion(descriptor, renderable, debugRecord,
          layoutMeasurement, frameInput);
        didSynchronousUpdate = true;
      }
    }

    emitDebugState();

    if (pendingUpdates.length === 0) {
      return {
        didSynchronousUpdate,
        schedulingMode: requiresContinuousRendering ? "continuous" : "on-demand",
      };
    }

    const pendingUpdate = Promise.all(pendingUpdates).then(
      () => { emitDebugState(true); },
      (error: unknown) => { emitDebugState(true); throw error; },
    );

    return {
      didSynchronousUpdate,
      schedulingMode: requiresContinuousRendering ? "continuous" : "on-demand",
      pendingUpdate,
    };
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

  function shouldKeepTargetContinuous(
    descriptor: TargetDescriptor,
    renderable: Renderable,
  ): boolean {
    const source = inferSourceDescriptor(descriptor);

    if (source.kind === "media" && source.type === "video") {
      return true;
    }

    if (isGateTarget(descriptor)) {
      return true;
    }

    if (hasPointerDeclaration(descriptor.declaration.pointer)) {
      return true;
    }

    return (
      targetState.effectControllersByTargetKey.get(descriptor.key)
        ?.hasEffects === true && renderable.status !== "disposed"
    );
  }

  function hasPointerDeclaration(
    pointer: WebGLDeclaration["pointer"],
  ): boolean {
    return (
      pointer?.move === true ||
      pointer?.click === true ||
      pointer?.drag === true
    );
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
      const target = renderable.effectTarget;

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
    visual: context.postprocessController,
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

function isPromiseLike(result: void | Promise<void>): result is Promise<void> {
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
