"use client";

import {
  addAfterEffect,
  Canvas,
  events as pointerEvents,
  useFrame,
  useThree,
  type CanvasProps,
} from "@react-three/fiber";
import { ErrorBoundary } from "react-error-boundary";
import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import {
  createRuntimeManager,
  type RuntimeController,
  type RuntimeDebugState,
  type RuntimeManager,
} from "./runtimeManager";
import type { DOMTargetOptions } from "./domRuntime";
import { withDrawnHits } from "./drawnHits";
import { isDevelopment } from "./diagnostics";
import { createReadyPixelCheck } from "./readyPixels";
import {
  budgetedDpr,
  createQualityStore,
  defaultQualityBudgets,
  initialQualityTier,
  type DprRange,
  type QualityBudgets,
  type QualityStore,
  type QualityTier,
  type RenderQuality,
} from "./renderQuality";
import type {
  WebGLProgressSignalSource,
  WebGLScrollAdapter,
} from "./runtimeTypes";

// Exported for tests only; not part of the public entrypoints.
export const RuntimeContext = createContext<RuntimeController | null>(null);
const QualityContext = createContext<QualityStore | null>(null);
const canvasStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  zIndex: 0,
};

export type WebGLRuntimeProps = {
  /** Semantic page DOM, rendered above the fixed Canvas. */
  children?: ReactNode;
  /** Native R3F/Three.js elements rendered inside the single Canvas. */
  scene?: ReactNode;
  /**
   * Props for the runtime-owned R3F Canvas (camera, dpr, frameloop, gl...).
   * Do not mount another `<Canvas>`, R3F root or `WebGLRenderer`.
   */
  canvas?: Omit<CanvasProps, "children" | "eventSource">;
  className?: string;
  style?: CSSProperties;
  progressSignals?: WebGLProgressSignalSource;
  scrollAdapter?: WebGLScrollAdapter;
  onDebugStateChange?: (state: RuntimeDebugState) => void;
  /**
   * Adaptive render quality (default on): the canvas pixel ratio follows a
   * per-tier pixel budget, and sustained slow frames step the tier down.
   * `canvas.dpr` bounds it (a number is the maximum). `false` uses
   * `canvas.dpr` unchanged. Read the result with `useRenderQuality()`.
   */
  quality?: false | WebGLQualityOptions;
  /**
   * Development warnings (console and `getDebugState().warnings`): sections
   * compiling on entry or containing lights, sustained over-budget frames,
   * frames below 30 fps at the lowest tier, and ready targets with no pixels.
   * Defaults to on unless `process.env.NODE_ENV` is `"production"`.
   */
  diagnostics?: boolean;
};

export type WebGLQualityOptions = {
  /** Move between tiers from measured frame times (default `true`). */
  adaptive?: boolean;
  /** Starting tier (default: `medium` on phones, `low` with Save-Data, else `high`). */
  tier?: QualityTier;
  /** Drawing-buffer pixels per tier (defaults 4.0, 2.0 and 1.0 megapixels). */
  budgets?: Partial<QualityBudgets>;
};

const defaultDpr: DprRange = { min: 0.5, max: 2 };

/**
 * The page's single R3F Canvas, renderer and frame loop, alongside semantic DOM.
 * Three objects belong in `scene`; hooks and targets must be its descendants.
 * Lost WebGL contexts and hidden tabs pause frames and restore DOM fallback.
 * Imports are SSR-safe; create textures and loaders after mount.
 */
export function WebGLRuntime({
  children,
  scene,
  canvas,
  className,
  style,
  progressSignals,
  scrollAdapter,
  onDebugStateChange,
  quality,
  diagnostics,
}: WebGLRuntimeProps) {
  const container = useRef<HTMLDivElement>(null);
  const [controller] = useState(createRuntimeManager);
  const [qualityStore] = useState(createQualityStore);
  const renderQuality = useSyncExternalStore(
    qualityStore.subscribe,
    qualityStore.get,
    qualityStore.get,
  );
  const managed = quality !== false;
  const range = readDprRange(canvas?.dpr);
  const budgets = {
    ...defaultQualityBudgets,
    ...(quality ? quality.budgets : {}),
  };
  const qualityKey = JSON.stringify([quality, range, budgets]);
  useQualityEnvironment(qualityStore, quality, qualityKey);
  useBudgetedDpr(
    qualityStore,
    managed,
    renderQuality.tier,
    budgets,
    range,
    qualityKey,
  );
  const debugCallback = useRef(onDebugStateChange);
  useLayoutEffect(() => {
    debugCallback.current = onDebugStateChange;
  }, [onDebugStateChange]);
  useLayoutEffect(() => {
    controller.diagnostics.setEnabled(diagnostics ?? isDevelopment());
  }, [controller, diagnostics]);
  useLayoutEffect(() => {
    controller.configure({ progressSignals, scrollAdapter });
    controller.manager.invalidate();
  }, [controller, progressSignals, scrollAdapter]);

  useEffect(() => {
    const unsubscribeProgress = progressSignals?.subscribe?.(
      controller.manager.invalidate,
    );
    const unsubscribeScroll = scrollAdapter?.subscribe?.(
      controller.manager.invalidate,
    );
    return () => {
      unsubscribeProgress?.();
      unsubscribeScroll?.();
    };
  }, [controller, progressSignals, scrollAdapter]);

  useEffect(() => {
    let previous: RuntimeDebugState | undefined;
    const reportAvailability = () => {
      if (!debugCallback.current) return;
      const state = controller.manager.getDebugState();
      if (previous?.ready === state.ready && previous?.error === state.error)
        return;
      previous = state;
      debugCallback.current(state);
    };
    // A paused or failed Canvas has no frame callback to report its state.
    reportAvailability();
    return controller.manager.subscribe(reportAvailability);
  }, [controller]);

  // Match R3F's final-removal lifetime: Activity hiding and StrictMode replay
  // disconnect effects but retain the runtime for the next visible mount.
  useInsertionEffect(() => () => controller.dispose(), [controller]);

  return (
    <QualityContext.Provider value={qualityStore}>
      <RuntimeContext.Provider value={controller}>
        <div
          ref={container}
          className={className}
          style={{ position: "relative", ...style }}
          data-webgl-runtime="r3f"
        >
          <ErrorBoundary
            onError={(error) => controller.setAvailable(false, error)}
            fallback={null}
          >
            <Canvas
              flat
              gl={{ alpha: true, antialias: false }}
              {...canvas}
              dpr={managed ? renderQuality.dpr : (canvas?.dpr ?? [1, 1.5])}
              // Objects hidden by a section (or the application) receive no events.
              events={(store) =>
                withDrawnHits((canvas?.events ?? pointerEvents)(store))
              }
              eventSource={container}
              eventPrefix="client"
              style={{ ...canvas?.style, ...canvasStyle }}
              fallback={<Unavailable controller={controller} />}
            >
              <QualityContext.Provider value={qualityStore}>
                <RuntimeContext.Provider value={controller}>
                  <RuntimeFrame
                    controller={controller}
                    quality={qualityStore}
                    frameloop={canvas?.frameloop ?? "always"}
                    onDebugStateChange={onDebugStateChange}
                  />
                  {scene}
                </RuntimeContext.Provider>
              </QualityContext.Provider>
            </Canvas>
          </ErrorBoundary>
          <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
        </div>
      </RuntimeContext.Provider>
    </QualityContext.Provider>
  );
}

function readDprRange(dpr: CanvasProps["dpr"]): DprRange {
  if (typeof dpr === "number") return { min: defaultDpr.min, max: dpr };
  if (Array.isArray(dpr)) return { min: dpr[0], max: dpr[1] };
  return defaultDpr;
}

// Device signals and reduced motion are read after mount (SSR-safe).
function useQualityEnvironment(
  store: QualityStore,
  quality: WebGLRuntimeProps["quality"],
  key: string,
) {
  const latest = useRef(quality);
  useLayoutEffect(() => {
    latest.current = quality;
  });
  useEffect(() => {
    const options = latest.current;
    const tier =
      (options ? options.tier : undefined) ??
      (options === false
        ? "high"
        : initialQualityTier({
            coarsePointer: queryMedia("(pointer: coarse)")?.matches ?? false,
            smallScreen:
              Math.min(window.screen.width, window.screen.height) < 768,
            saveData: readSaveData(),
          }));
    store.configure(tier, options !== false && options?.adaptive !== false);
    const motion = queryMedia("(prefers-reduced-motion: reduce)");
    if (!motion) return;
    const updateMotion = () => store.setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener("change", updateMotion);
    return () => motion.removeEventListener("change", updateMotion);
  }, [store, key]);
}

// Some embedded browsers and test environments have no matchMedia.
function queryMedia(query: string) {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(query)
    : undefined;
}

function readSaveData() {
  const connection: unknown = Reflect.get(navigator, "connection");
  return (
    typeof connection === "object" &&
    connection !== null &&
    Reflect.get(connection, "saveData") === true
  );
}

// The canvas fills the viewport, so the window size is the drawing area.
function useBudgetedDpr(
  store: QualityStore,
  managed: boolean,
  tier: QualityTier,
  budgets: QualityBudgets,
  range: DprRange,
  key: string,
) {
  const latest = useRef({ budgets, range });
  useLayoutEffect(() => {
    latest.current = { budgets, range };
  });
  useEffect(() => {
    if (!managed) return;
    const update = () =>
      store.setDpr(
        budgetedDpr(
          tier,
          latest.current.budgets,
          { width: window.innerWidth, height: window.innerHeight },
          window.devicePixelRatio || 1,
          latest.current.range,
        ),
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [store, managed, tier, key]);
}

function Unavailable({ controller }: { controller: RuntimeController }) {
  useEffect(() => {
    controller.setAvailable(false);
  }, [controller]);
  return null;
}

function RuntimeFrame({
  controller,
  quality,
  frameloop,
  onDebugStateChange,
}: {
  controller: RuntimeController;
  quality: QualityStore;
  frameloop: NonNullable<CanvasProps["frameloop"]>;
  onDebugStateChange?: (state: RuntimeDebugState) => void;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const clock = useThree((state) => state.clock);
  const lastDebugTime = useRef(-Infinity);

  // After rendering, before compositing: the drawing buffer is still readable.
  useEffect(() => {
    const check = createReadyPixelCheck((id) =>
      controller.diagnostics.warn(
        "ready-without-pixels",
        id,
        `Target "${id}" hides its DOM fallback, but nothing was drawn inside its rectangle for 30 frames. Call setTargetReady(true) only once the visual renders (its texture and uniforms reach the material).`,
      ),
    );
    const context = gl.getContext();
    const pixel = new Uint8Array(4);
    return addAfterEffect(() => {
      if (!controller.diagnostics.enabled) return;
      const targets = controller.inspectTargets();
      if (!targets.some((target) => target.hidden && target.visible)) return;
      const canvas = gl.domElement;
      const opaque = gl.getClearAlpha() >= 1 || scene.background !== null;
      const scale = canvas.width / Math.max(1, canvas.clientWidth);
      check.check(
        targets,
        opaque
          ? undefined
          : {
              width: canvas.clientWidth,
              height: canvas.clientHeight,
              alpha(x, y) {
                context.readPixels(
                  Math.floor(x * scale),
                  Math.floor(canvas.height - y * scale - 1),
                  1,
                  1,
                  context.RGBA,
                  context.UNSIGNED_BYTE,
                  pixel,
                );
                return pixel[3];
              },
            },
      );
    });
  }, [controller, gl, scene]);

  useLayoutEffect(() => {
    const disconnect = controller.connect(invalidate);
    const canvas = gl.domElement;
    let contextLost = gl.getContext().isContextLost();
    const syncAvailability = () => {
      const available = !contextLost && !document.hidden;
      controller.setAvailable(available);
      const elapsedTime = clock.elapsedTime;
      setFrameloop(available ? frameloop : "never");
      // R3F resets its clock on mode changes. A temporary pause must not rewind
      // native useFrame animations or the debug notification throttle.
      clock.elapsedTime = elapsedTime;
      if (available) invalidate();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      syncAvailability();
    };
    const restored = () => {
      contextLost = false;
      syncAvailability();
    };
    const visibility = syncAvailability;
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    document.addEventListener("visibilitychange", visibility);
    syncAvailability();
    return () => {
      controller.setAvailable(false);
      disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [controller, gl, clock, invalidate, frameloop, setFrameloop]);

  useFrame((state, delta) => {
    controller.measure(state.size);
    quality.sample(delta * 1000, performance.now());
    // `gl.info` still holds the previous render's counters here.
    const info = gl.info;
    controller.diagnostics.recordFrame({
      deltaMs: delta * 1000,
      calls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
      tier: quality.get().tier,
      dpr: gl.getPixelRatio(),
    });
    if (
      onDebugStateChange &&
      state.clock.elapsedTime - lastDebugTime.current >= 0.1
    ) {
      lastDebugTime.current = state.clock.elapsedTime;
      onDebugStateChange(controller.manager.getDebugState());
    }
  }, -100);
  return null;
}

/** The runtime controller for internal components such as sections. */
export function useController() {
  const controller = useContext(RuntimeContext);
  if (!controller)
    throw new Error("WebGL hooks and targets must be inside WebGLRuntime.");
  return controller;
}

/**
 * The runtime's current tier, pixel ratio and reduced-motion preference.
 * Scale optional work (particle counts, steps, layers) by `tier`.
 */
export function useRenderQuality(): RenderQuality {
  const store = useContext(QualityContext);
  if (!store)
    throw new Error("WebGL hooks and targets must be inside WebGLRuntime.");
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** The surrounding runtime's DOM coordination. Throws outside `WebGLRuntime`. */
export function useWebGLRuntime(): RuntimeManager {
  return useController().manager;
}

/**
 * Re-renders when target `id` registers or unregisters, not when it moves.
 * Read the returned state's mutable fields (rect, visible, revision) in
 * `useFrame`, and pass it to `setTargetReady` as the captured target.
 */
export function useDOMTarget(id: string) {
  const runtime = useWebGLRuntime();
  return useSyncExternalStore(
    runtime.subscribe,
    () => runtime.getTarget(id),
    () => undefined,
  );
}

export type WebGLTargetProps = DOMTargetOptions & {
  id: string;
  children: ReactElement<
    HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }
  >;
};

/**
 * Registers its single ref-capable DOM child as target `id`. The child remains
 * the semantic, accessible fallback; see `hideWhenReady` and `offscreen`.
 */
export function WebGLTarget({
  id,
  children,
  hideWhenReady,
  offscreen,
}: WebGLTargetProps) {
  const controller = useController();
  const originalRef = children.props.ref;
  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      const originalCleanup =
        typeof originalRef === "function" ? originalRef(element) : undefined;
      if (originalRef && typeof originalRef !== "function")
        originalRef.current = element;
      const unregister = controller.register(id, element, {
        hideWhenReady,
        offscreen,
      });
      return () => {
        unregister();
        if (typeof originalCleanup === "function") originalCleanup();
        else if (typeof originalRef === "function") originalRef(null);
        else if (originalRef) originalRef.current = null;
      };
    },
    [controller, id, hideWhenReady, offscreen, originalRef],
  );
  return cloneElement(children, { ref });
}
