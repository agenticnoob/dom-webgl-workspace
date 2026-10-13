"use client";

import {
  Canvas,
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
import type {
  WebGLProgressSignalSource,
  WebGLScrollAdapter,
} from "./runtimeTypes";

const RuntimeContext = createContext<RuntimeController | null>(null);
const canvasStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  zIndex: 0,
};

export type WebGLRuntimeProps = {
  children?: ReactNode;
  scene?: ReactNode;
  canvas?: Omit<CanvasProps, "children" | "eventSource">;
  className?: string;
  style?: CSSProperties;
  progressSignals?: WebGLProgressSignalSource;
  scrollAdapter?: WebGLScrollAdapter;
  onDebugStateChange?: (state: RuntimeDebugState) => void;
};

/** One R3F root alongside semantic DOM. Three objects belong in `scene`. */
export function WebGLRuntime({
  children,
  scene,
  canvas,
  className,
  style,
  progressSignals,
  scrollAdapter,
  onDebugStateChange,
}: WebGLRuntimeProps) {
  const container = useRef<HTMLDivElement>(null);
  const [controller] = useState(createRuntimeManager);
  const debugCallback = useRef(onDebugStateChange);
  useLayoutEffect(() => {
    debugCallback.current = onDebugStateChange;
  }, [onDebugStateChange]);
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
            dpr={[1, 1.5]}
            {...canvas}
            eventSource={container}
            eventPrefix="client"
            style={{ ...canvas?.style, ...canvasStyle }}
            fallback={<Unavailable controller={controller} />}
          >
            <RuntimeContext.Provider value={controller}>
              <RuntimeFrame
                controller={controller}
                frameloop={canvas?.frameloop ?? "always"}
                onDebugStateChange={onDebugStateChange}
              />
              {scene}
            </RuntimeContext.Provider>
          </Canvas>
        </ErrorBoundary>
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    </RuntimeContext.Provider>
  );
}

function Unavailable({ controller }: { controller: RuntimeController }) {
  useEffect(() => {
    controller.setAvailable(false);
  }, [controller]);
  return null;
}

function RuntimeFrame({
  controller,
  frameloop,
  onDebugStateChange,
}: {
  controller: RuntimeController;
  frameloop: NonNullable<CanvasProps["frameloop"]>;
  onDebugStateChange?: (state: RuntimeDebugState) => void;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const gl = useThree((state) => state.gl);
  const clock = useThree((state) => state.clock);
  const lastDebugTime = useRef(-Infinity);

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

  useFrame((state) => {
    controller.measure(state.size);
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

function useController() {
  const controller = useContext(RuntimeContext);
  if (!controller)
    throw new Error("WebGL hooks and targets must be inside WebGLRuntime.");
  return controller;
}

export function useWebGLRuntime(): RuntimeManager {
  return useController().manager;
}

/** Target identity is reactive; read the live rect in useFrame for animation. */
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
