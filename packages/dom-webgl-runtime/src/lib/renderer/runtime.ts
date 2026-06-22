import {
  createDebugState,
  type DebugRuntimeState,
} from "../debug/debugState";
import type {
  WebGLDebugState,
  WebGLDeclaration,
  WebGLFrameInput,
  WebGLLifecycleState,
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
import {
  createFallbackVisibilityController,
} from "../dom/fallbackVisibility";
import type { TargetDescriptor } from "../dom/targetDescriptor";
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
import { compileRenderPolicy } from "../render/renderPolicy";
import { inferRenderRole } from "../render/renderRole";
import { createResourceManager } from "../resources/resourceManager";
import { inferSourceDescriptor } from "../source/inferSource";
import { createLayoutPass, type ElementLayoutSnapshot } from "./layoutPass";
import { compileOffscreenPolicy } from "./offscreenPolicy";
import {
  createThreeRendererHost,
  type ThreeRendererHost,
} from "./threeRenderer";
import { createRendererLoop } from "./rendererLoop";
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
};

type SyncFrameResult = {
  didSynchronousUpdate: boolean;
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
  const resourceManager = createResourceManager();
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
  const invalidationController =
    internalOptions.invalidationController ?? createDOMInvalidationController();
  const targetState = createTargetRuntimeState(
    internalOptions.renderables ?? [],
  );
  const renderableFactoryContext: PipelineRenderableContext = {
    resourceManager,
    sceneAdapter: rendererHost.sceneAdapter,
    measureElement: internalOptions.measureElement ?? measureElement,
    getViewportSize: () => rendererHost.getViewportSize(),
    loadVideo: internalOptions.loadVideo,
    loadModel: internalOptions.loadModel,
    effectRegistry: createWebGLEffectRegistry(options.effects ?? []),
  };
  let nextScanOrder = 0;
  let disposed = false;
  let loopSyncPending = false;

  const rendererLoop = createRendererLoop({
    renderer: rendererHost.renderer,
    beforeRender() {
      if (loopSyncPending) {
        return;
      }

      try {
        const result = syncFrame();

        if (result.pendingUpdate) {
          loopSyncPending = true;
          result.pendingUpdate
            .catch((error: unknown) => {
              console.error("WebGL runtime frame sync failed.", error);
            })
            .finally(() => {
              loopSyncPending = false;
            });
        }
      } catch (error: unknown) {
        console.error("WebGL runtime frame sync failed.", error);
      }
    },
    render() {
      renderScene();
    },
  });

  ownerDocument.addEventListener("visibilitychange", handleVisibilityChange);
  rendererLoop.start();

  return {
    container: options.container,
    registerTarget(element, declaration) {
      if (disposed) {
        throw new Error("Cannot register a WebGL target after runtime disposal.");
      }

      const descriptor = registry.register(element, declaration, nextScanOrder);
      nextScanOrder += 1;
      registerGateTarget(scrollState, descriptor);
      invalidationController.observeTarget({
        key: descriptor.key,
        element: descriptor.element,
      });
      emitDebugState();

      return;
    },
    unregisterTarget(key) {
      const targetKey = key.trim();
      const descriptor = registry.get(targetKey);

      registry.unregister(targetKey);
      invalidationController.unobserveTarget(targetKey);
      unregisterGateTarget(scrollState, descriptor);
      restoreFallbackVisibility(targetState, targetKey);
      targetState.fallbackControllersByTargetKey.delete(targetKey);
      disposeTargetRenderable(targetState, targetKey);
      emitDebugState();
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
        releaseActiveGate(scrollState);
        scrollState.dispose?.();
        pointerController.dispose();
        rendererLoop.dispose();
        rendererHost.dispose();
        emitDebugState();
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
        targets: [],
      });
    }

    return createDebugState({
      targetCount: descriptors.length,
      renderableCount: targetState.renderablesByTargetKey.size,
      ...readDebugScrollState(scroll),
      pointer: frameInput.pointer,
      targets: descriptors.map((descriptor) => ({
        key: descriptor.key,
        ...readTargetDebugRecord(descriptor, targetState),
      })),
    });
  }

  function emitDebugState(): void {
    internalOptions.onDebugStateChange?.(createCurrentDebugState());
  }

  function renderScene(): void {
    if (disposed) {
      return;
    }

    rendererHost.sceneAdapter.render();
  }

  function syncFrame(): SyncFrameResult {
    if (disposed) {
      return { didSynchronousUpdate: false };
    }

    const descriptors = listTargetsInScanOrder(registry);
    const frameInput = frameInputSource.update();

    rendererHost.resizeIfNeeded();
    const dirtyKeys = invalidationController.consumeDirtyKeys();

    let layoutMeasurements: Map<string, ElementLayoutSnapshot>;

    try {
      layoutMeasurements = layoutPass.measure(
        descriptors.map((descriptor) => ({
          key: descriptor.key,
          element: descriptor.element,
          active: true,
        })),
      );
    } catch (error: unknown) {
      for (const descriptor of descriptors) {
        markDebugRecordError(
          readTargetDebugRecord(descriptor, targetState),
          error,
        );
      }
      releaseActiveGate(scrollState);
      emitDebugState();
      throw error;
    }

    const viewportLifecycle = createCurrentViewportLifecycle();
    const pendingUpdates: Array<Promise<void>> = [];
    let didSynchronousUpdate = false;

    for (const descriptor of descriptors) {
      let debugRecord = readTargetDebugRecord(descriptor, targetState);
      const layoutMeasurement = layoutMeasurements.get(descriptor.key);
      const viewportState = layoutMeasurement
        ? viewportLifecycle.classify(layoutMeasurement)
        : "active";
      let renderable = targetState.renderablesByTargetKey.get(descriptor.key);

      if (viewportState === "disposed") {
        disposeOffscreenRenderable(targetState, {
          key: descriptor.key,
          renderable,
          restoreFallback: true,
        });
        debugRecord.lifecycleState = "disposed";
        debugRecord.visible = false;
        continue;
      }

      if (viewportState !== "active") {
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
          continue;
        }

        if (renderable && offscreenPolicy.strategy === "park") {
          if (!targetState.parkedAtByTargetKey.has(descriptor.key)) {
            targetState.parkedAtByTargetKey.set(descriptor.key, frameInput.time);
            targetState.parkedVisibilityByTargetKey.set(
              descriptor.key,
              readRenderableVisibilityForPark(
                targetState,
                descriptor.key,
                renderable,
              ),
            );
            bumpLifecycleVersion(targetState, descriptor.key);
          }
          renderable.setVisible(false);
          debugRecord.lifecycleState = "paused";
          debugRecord.visible = false;
          continue;
        }

        debugRecord.lifecycleState =
          viewportState === "preloading" ? "preloading" : "inactive";
        continue;
      }

      const wasParked = targetState.parkedAtByTargetKey.delete(descriptor.key);
      if (wasParked) {
        renderable?.setVisible(
          targetState.parkedVisibilityByTargetKey.get(descriptor.key) ?? true,
        );
        targetState.parkedVisibilityByTargetKey.delete(descriptor.key);
      }

      if (!renderable) {
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
          releaseActiveGate(scrollState);
          emitDebugState();
          throw error;
        }

        renderable = pipeline.renderable;
        debugRecord = pipeline.debugRecord;
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
            { defaultHideWhenReady: true, defaultHideMode: "self" },
          ),
        );
        targetState.renderables.add(renderable);
        internalOptions.onRenderableCreated?.(renderable);
      }

      if (dirtyKeys.has(descriptor.key)) {
        renderable.invalidateContent?.();
      }

      let result: void | Promise<void>;
      const lifecycleVersion = readLifecycleVersion(
        targetState,
        descriptor.key,
      );

      try {
        result = renderable.update(frameInput);
      } catch (error: unknown) {
        markDebugRecordError(debugRecord, error);
        restoreFallbackVisibility(targetState, descriptor.key);
        releaseActiveGate(scrollState);
        emitDebugState();
        throw error;
      }

      if (isPromiseLike(result)) {
        markDebugRecordLoading(debugRecord);
        restoreFallbackVisibility(targetState, descriptor.key);
        pendingUpdates.push(
          result
            .then(() => {
              if (targetState.renderablesByTargetKey.get(descriptor.key) !== renderable) {
                return;
              }
              if (
                readLifecycleVersion(
                  targetState,
                  descriptor.key,
                ) !== lifecycleVersion
              ) {
                return;
              }
              if (targetState.parkedAtByTargetKey.has(descriptor.key)) {
                return;
              }

              if (layoutMeasurement) {
                renderable.updateLayout?.(layoutMeasurement);
                targetState.effectControllersByTargetKey
                  .get(descriptor.key)
                  ?.update(frameInput, layoutMeasurement);
              }
              syncDebugRecordFromRenderable(debugRecord, renderable);
              syncFallbackVisibility(
                targetState,
                descriptor,
                renderable,
              );
            })
            .catch((error: unknown) => {
              if (targetState.renderablesByTargetKey.get(descriptor.key) !== renderable) {
                if (targetState.retiredRenderables.has(renderable)) {
                  return;
                }
                throw error;
              }
              if (
                readLifecycleVersion(
                  targetState,
                  descriptor.key,
                ) !== lifecycleVersion
              ) {
                return;
              }
              if (targetState.parkedAtByTargetKey.has(descriptor.key)) {
                return;
              }

              markDebugRecordError(debugRecord, error);
              restoreFallbackVisibility(targetState, descriptor.key);
              releaseActiveGate(scrollState);
              throw error;
            }),
        );
      } else {
        if (layoutMeasurement) {
          renderable.updateLayout?.(layoutMeasurement);
          targetState.effectControllersByTargetKey
            .get(descriptor.key)
            ?.update(frameInput, layoutMeasurement);
        }
        syncDebugRecordFromRenderable(debugRecord, renderable);
        syncFallbackVisibility(
          targetState,
          descriptor,
          renderable,
        );
        didSynchronousUpdate = true;
      }
    }

    emitDebugState();

    if (pendingUpdates.length === 0) {
      return { didSynchronousUpdate };
    }

    return {
      didSynchronousUpdate,
      pendingUpdate: Promise.all(pendingUpdates).then(
        () => {
          emitDebugState();
        },
        (error: unknown) => {
          emitDebugState();
          throw error;
        },
      ),
    };
  }

  function handleVisibilityChange(): void {
    if (disposed || ownerDocument.visibilityState !== "hidden") {
      return;
    }

    releaseActiveGate(scrollState);
    emitDebugState();
  }

  function createCurrentViewportLifecycle() {
    return createViewportLifecycle({
      viewportHeight: window.innerHeight || 600,
      activeMargin: "50vh",
      preloadMargin: "150vh",
      mountMargin: "100vh",
      unloadMargin: "250vh",
    });
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
    sourceKind: source.kind,
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
    sourceKind: source.kind,
    renderRole: inferRenderRole(source, descriptor.declaration),
    resourceStatus: "idle",
    lifecycleState: "declared",
    visible: true,
  };

  targetState.debugRecordsByTargetKey.set(descriptor.key, record);

  return record;
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
