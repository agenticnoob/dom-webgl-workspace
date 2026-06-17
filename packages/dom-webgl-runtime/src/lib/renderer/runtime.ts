import {
  createDebugState,
  type DebugRuntimeState,
  type DebugTargetState,
} from "../debug/debugState";
import type {
  WebGLDebugState,
  WebGLDeclaration,
  WebGLFrameInput,
  WebGLResourceStatus,
  WebGLRuntime,
  WebGLRuntimeOptions,
} from "../types";

import {
  createTargetRegistry,
  type TargetRegistry,
} from "../dom/registry";
import {
  createFallbackVisibilityController,
  type FallbackHideMode,
  type FallbackVisibilityController,
} from "../dom/fallbackVisibility";
import type { TargetDescriptor } from "../dom/targetDescriptor";
import {
  createFrameInputSource,
  type FrameClock,
  type ScrollStateController,
} from "../input/frameInput";
import { type PageScrollMetrics } from "../input/pageScroll";
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
import {
  isRenderableVisuallyReady,
  type Renderable,
} from "../render/renderable";
import { compileRenderPolicy } from "../render/renderPolicy";
import { inferRenderRole } from "../render/renderRole";
import { createResourceManager } from "../resources/resourceManager";
import { inferSourceDescriptor } from "../source/inferSource";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import {
  createThreeRendererHost,
  type ThreeRendererHost,
} from "./threeRenderer";

export type { WebGLRuntime, WebGLRuntimeOptions } from "../types";

type DisposableRenderable = {
  dispose(): void;
};

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

type TargetDebugRecord = Omit<DebugTargetState, "key">;

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
      getScrollMetrics: readPageScrollMetrics,
      scrollLock: createScrollLockController(document.documentElement),
      eventTarget: options.container,
    });
  const ownerDocument = options.container.ownerDocument;
  const pointerController =
    internalOptions.pointerController ?? createPointerController(options.container);
  const frameInputSource = createFrameInputSource(
    scrollState,
    pointerController,
    internalOptions.clock ?? readClock,
  );
  const renderables = new Set<DisposableRenderable>(
    internalOptions.renderables ?? [],
  );
  const renderablesByTargetKey = new Map<string, Renderable>();
  const debugRecordsByTargetKey = new Map<string, TargetDebugRecord>();
  const fallbackControllersByTargetKey = new Map<
    string,
    FallbackVisibilityController
  >();
  const renderableFactoryContext: RenderableFactoryContext = {
    resourceManager,
    sceneAdapter: rendererHost.sceneAdapter,
    measureElement: internalOptions.measureElement ?? measureElement,
    loadVideo: internalOptions.loadVideo,
    loadModel: internalOptions.loadModel,
  };
  let nextScanOrder = 0;
  let disposed = false;

  ownerDocument.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    container: options.container,
    registerTarget(element, declaration) {
      if (disposed) {
        throw new Error("Cannot register a WebGL target after runtime disposal.");
      }

      const descriptor = registry.register(element, declaration, nextScanOrder);
      nextScanOrder += 1;
      registerGateTarget(scrollState, descriptor);
      emitDebugState();

      return;
    },
    unregisterTarget(key) {
      const targetKey = key.trim();
      const descriptor = registry.get(targetKey);

      registry.unregister(targetKey);
      unregisterGateTarget(scrollState, descriptor);
      restoreFallbackVisibility(fallbackControllersByTargetKey, targetKey);
      fallbackControllersByTargetKey.delete(targetKey);
      disposeTargetRenderable(
        targetKey,
        renderablesByTargetKey,
        renderables,
        debugRecordsByTargetKey,
      );
      emitDebugState();
    },
    sync() {
      if (disposed) {
        return;
      }

      const descriptors = listTargetsInScanOrder(registry);
      const frameInput = frameInputSource.update();

      for (const descriptor of descriptors) {
        if (renderablesByTargetKey.has(descriptor.key)) {
          continue;
        }

        const { renderable, debugRecord, source } = createPipelineRenderable(
          descriptor,
          renderableFactoryContext,
        );

        renderablesByTargetKey.set(descriptor.key, renderable);
        debugRecordsByTargetKey.set(descriptor.key, debugRecord);
        fallbackControllersByTargetKey.set(
          descriptor.key,
          createFallbackVisibilityController(
            descriptor.element,
            descriptor.declaration.lifecycle ?? {},
            { defaultHideMode: readDefaultFallbackHideMode(source) },
          ),
        );
        renderables.add(renderable);
        internalOptions.onRenderableCreated?.(renderable);
      }

      const pendingUpdates: Array<Promise<void>> = [];

      for (const descriptor of descriptors) {
        const renderable = renderablesByTargetKey.get(descriptor.key);

        if (!renderable) {
          continue;
        }

        const debugRecord = readTargetDebugRecord(
          descriptor,
          debugRecordsByTargetKey,
        );
        let result: void | Promise<void>;

        try {
          result = renderable.update(frameInput);
        } catch (error: unknown) {
          markDebugRecordError(debugRecord, error);
          restoreFallbackVisibility(fallbackControllersByTargetKey, descriptor.key);
          releaseActiveGate(scrollState);
          emitDebugState();
          throw error;
        }

        if (isPromiseLike(result)) {
          markDebugRecordLoading(debugRecord);
          restoreFallbackVisibility(fallbackControllersByTargetKey, descriptor.key);
          pendingUpdates.push(
            result
              .then(() => {
                if (renderablesByTargetKey.get(descriptor.key) !== renderable) {
                  return;
                }

                syncDebugRecordFromRenderable(debugRecord, renderable);
                syncFallbackVisibility(
                  descriptor,
                  renderable,
                  fallbackControllersByTargetKey,
                );
              })
              .catch((error: unknown) => {
                if (renderablesByTargetKey.get(descriptor.key) !== renderable) {
                  throw error;
                }

                markDebugRecordError(debugRecord, error);
                restoreFallbackVisibility(
                  fallbackControllersByTargetKey,
                  descriptor.key,
                );
                releaseActiveGate(scrollState);
                throw error;
              }),
          );
        } else {
          syncDebugRecordFromRenderable(debugRecord, renderable);
          syncFallbackVisibility(
            descriptor,
            renderable,
            fallbackControllersByTargetKey,
          );
        }
      }

      if (pendingUpdates.length > 0) {
        emitDebugState();

        return Promise.all(pendingUpdates).then(
          () => {
            emitDebugState();
          },
          (error: unknown) => {
            emitDebugState();
            throw error;
          },
        );
      }

      emitDebugState();
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
        for (const renderable of renderables) {
          renderable.dispose();
        }
      } finally {
        renderablesByTargetKey.clear();
        renderables.clear();
        debugRecordsByTargetKey.clear();
        restoreAllFallbackVisibility(fallbackControllersByTargetKey);
        fallbackControllersByTargetKey.clear();
        ownerDocument.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        releaseActiveGate(scrollState);
        scrollState.dispose?.();
        pointerController.dispose();
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
      renderableCount: renderablesByTargetKey.size,
      ...readDebugScrollState(scroll),
      pointer: frameInput.pointer,
      targets: descriptors.map((descriptor) => ({
        key: descriptor.key,
        ...readTargetDebugRecord(descriptor, debugRecordsByTargetKey),
      })),
    });
  }

  function emitDebugState(): void {
    internalOptions.onDebugStateChange?.(createCurrentDebugState());
  }

  function handleVisibilityChange(): void {
    if (disposed || ownerDocument.visibilityState !== "hidden") {
      return;
    }

    releaseActiveGate(scrollState);
    emitDebugState();
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
  context: RenderableFactoryContext,
): {
  renderable: Renderable;
  debugRecord: TargetDebugRecord;
  source: WebGLSourceDescriptor;
} {
  const source = inferSourceDescriptor(descriptor);
  const role = inferRenderRole(source, descriptor.declaration);
  const policy = compileRenderPolicy(role);
  const debugRecord: TargetDebugRecord = {
    sourceKind: source.kind,
    renderRole: role,
    resourceStatus: "idle",
    visible: true,
  };
  const renderable = createRenderable(descriptor, source, role, policy, context);

  return {
    renderable: attachDebugBookkeeping(renderable, debugRecord),
    debugRecord,
    source,
  };
}

function disposeTargetRenderable(
  key: string,
  renderablesByTargetKey: Map<string, Renderable>,
  renderables: Set<DisposableRenderable>,
  debugRecordsByTargetKey: Map<string, TargetDebugRecord>,
): void {
  const renderable = renderablesByTargetKey.get(key);

  if (!renderable) {
    debugRecordsByTargetKey.delete(key);
    return;
  }

  renderablesByTargetKey.delete(key);
  renderables.delete(renderable);
  debugRecordsByTargetKey.delete(key);
  renderable.dispose();
}

function syncFallbackVisibility(
  descriptor: TargetDescriptor,
  renderable: Renderable,
  fallbackControllersByTargetKey: Map<string, FallbackVisibilityController>,
): void {
  const controller = fallbackControllersByTargetKey.get(descriptor.key);

  if (!controller) {
    return;
  }

  if (isRenderableVisuallyReady(renderable)) {
    controller.hide();
    return;
  }

  controller.restore();
}

function restoreFallbackVisibility(
  fallbackControllersByTargetKey: Map<string, FallbackVisibilityController>,
  key: string,
): void {
  const controller = fallbackControllersByTargetKey.get(key);

  if (!controller) {
    return;
  }

  controller.restore();
}

function restoreAllFallbackVisibility(
  fallbackControllersByTargetKey: Map<string, FallbackVisibilityController>,
): void {
  for (const controller of fallbackControllersByTargetKey.values()) {
    controller.restore();
  }
}

function readTargetDebugRecord(
  descriptor: TargetDescriptor,
  debugRecordsByTargetKey: Map<string, TargetDebugRecord>,
): TargetDebugRecord {
  const existing = debugRecordsByTargetKey.get(descriptor.key);

  if (existing) {
    return existing;
  }

  const source = inferSourceDescriptor(descriptor);
  const record: TargetDebugRecord = {
    sourceKind: source.kind,
    renderRole: inferRenderRole(source, descriptor.declaration),
    resourceStatus: "idle",
    visible: true,
  };

  debugRecordsByTargetKey.set(descriptor.key, record);

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

  if (renderable.status !== "error") {
    delete debugRecord.error;
  }
}

function markDebugRecordError(
  debugRecord: TargetDebugRecord,
  error: unknown,
): void {
  debugRecord.resourceStatus = "error";
  debugRecord.error = error;
}

function markDebugRecordLoading(debugRecord: TargetDebugRecord): void {
  debugRecord.resourceStatus = "loading";
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

function readDefaultFallbackHideMode(
  source: WebGLSourceDescriptor,
): FallbackHideMode {
  if (source.kind === "snapshot" && source.mode === "element") {
    return "self";
  }

  return "subtree";
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

function readPageScrollMetrics(): PageScrollMetrics {
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
