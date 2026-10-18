import {
  createDOMTargetRegistry,
  type DOMTargetOptions,
  type DOMTargetState,
} from "./domRuntime";
import type {
  WebGLProgressSignalSource,
  WebGLScrollAdapter,
  WebGLScrollMetrics,
} from "./runtimeTypes";

/** Availability and target readiness. `ready` does not prove pixels were drawn. */
export type RuntimeDebugState = {
  ready: boolean;
  targetCount: number;
  targets: Array<{ id: string; visible: boolean; ready: boolean }>;
  error?: string;
};

/** DOM coordination returned by `useWebGLRuntime()`; not a renderer API. */
export type RuntimeManager = {
  /** Shared progress inputs; read `progress.get(key)` inside `useFrame`. */
  readonly progress: WebGLProgressSignalSource;
  /** Current scroll metrics from the scroll adapter or the window. */
  readonly scroll: WebGLScrollMetrics;
  getTarget(id: string): DOMTargetState | undefined;
  /**
   * Report whether the visual replacing target `id` can render. Call `true`
   * only after its model/texture exists and `false` on release; never `true`
   * after a load error. Pass the target captured when asynchronous work
   * started as `expected`, so a stale load cannot affect a remounted target.
   */
  setTargetReady(id: string, ready: boolean, expected?: DOMTargetState): void;
  /** Request a frame, e.g. after external state changes under `frameloop: "demand"`. */
  invalidate(): void;
  /** Notified on target registration, readiness and availability changes. */
  subscribe(listener: () => void): () => void;
  getDebugState(): RuntimeDebugState;
};

const emptyProgress: WebGLProgressSignalSource = { get: () => 0 };

export function createRuntimeManager() {
  let progress = emptyProgress;
  let scrollAdapter: WebGLScrollAdapter | undefined;
  let requestFrame = () => {};
  let available = false;
  let error: string | undefined;
  let disposed = false;
  const listeners = new Set<() => void>();
  const targetIds = new Set<string>();
  const targets = createDOMTargetRegistry(() => requestFrame());

  function notify() {
    for (const listener of listeners) listener();
    requestFrame();
  }

  const manager: RuntimeManager = {
    get progress() {
      return progress;
    },
    get scroll() {
      return (
        scrollAdapter?.readMetrics() ?? {
          scrollY: typeof window === "undefined" ? 0 : window.scrollY,
          scrollHeight:
            typeof document === "undefined"
              ? 0
              : document.documentElement.scrollHeight,
          viewportHeight:
            typeof window === "undefined" ? 0 : window.innerHeight,
        }
      );
    },
    getTarget: (id) => targets.get(id),
    setTargetReady(id, ready, expected) {
      if (disposed) return;
      const target = targets.get(id);
      if (
        !target ||
        (expected && expected !== target) ||
        target.ready === ready
      )
        return;
      targets.setReady(id, ready, expected);
      notify();
    },
    invalidate() {
      if (!disposed) requestFrame();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getDebugState() {
      return {
        ready: available,
        targetCount: targetIds.size,
        targets: [...targetIds].flatMap((id) => {
          const target = targets.get(id);
          return target
            ? [{ id, ready: target.ready, visible: target.visible }]
            : [];
        }),
        ...(error ? { error } : {}),
      };
    },
  };

  return {
    manager,
    configure(next: {
      progressSignals?: WebGLProgressSignalSource;
      scrollAdapter?: WebGLScrollAdapter;
    }) {
      progress = next.progressSignals ?? emptyProgress;
      scrollAdapter = next.scrollAdapter;
    },
    connect(invalidate: () => void) {
      requestFrame = invalidate;
      requestFrame();
      return () => {
        requestFrame = () => {};
      };
    },
    register(id: string, element: HTMLElement, options: DOMTargetOptions) {
      if (disposed)
        throw new Error("Cannot register a DOM target after runtime disposal.");
      const unregister = targets.register(id, element, options);
      const target = targets.get(id);
      targetIds.add(id);
      notify();
      return () => {
        if (targets.get(id) !== target) return;
        unregister();
        targetIds.delete(id);
        notify();
      };
    },
    measure: targets.measure,
    setAvailable(next: boolean, cause?: unknown) {
      if (disposed) return;
      available = next;
      if (cause !== undefined)
        error = cause instanceof Error ? cause.message : String(cause);
      else if (next) error = undefined;
      targets.setAvailable(next);
      notify();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      available = false;
      targets.dispose();
      targetIds.clear();
      listeners.clear();
      requestFrame = () => {};
    },
  };
}

export type RuntimeController = ReturnType<typeof createRuntimeManager>;
