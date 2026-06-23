import {
  createElement,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { createWebGLRuntime } from "../renderer/runtime";
import type {
  WebGLDebugState,
  WebGLDeclaration,
  WebGLRuntime as RuntimeInstance,
  WebGLRuntimeOptions,
} from "../types";

import { WebGLRuntimeProvider } from "./runtimeContext";

const runtimeContentLayerStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
};

export type WebGLRuntimeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  effects?: WebGLRuntimeOptions["effects"];
  scrollAdapter?: WebGLRuntimeOptions["scrollAdapter"];
  onDebugStateChange?: (state: WebGLDebugState) => void;
};

export function WebGLRuntime({
  children,
  className,
  style,
  effects,
  scrollAdapter,
  onDebugStateChange,
}: WebGLRuntimeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingRuntimeRef = useRef<RuntimeInstance | null>(null);
  const activeRuntimeRef = useRef<RuntimeInstance | null>(null);
  const failedEffectsRef = useRef<WebGLRuntimeOptions["effects"] | null>(null);
  const onDebugStateChangeRef = useRef(onDebugStateChange);
  const [runtime, setRuntime] = useState<RuntimeInstance | null>(null);

  onDebugStateChangeRef.current = onDebugStateChange;

  if (pendingRuntimeRef.current === null) {
    pendingRuntimeRef.current = createPendingRuntime();
  }

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (failedEffectsRef.current === effects) {
      return;
    }

    let nextRuntime: RuntimeInstance;

    try {
      nextRuntime = createWebGLRuntime({
        container,
        effects,
        scrollAdapter,
        onDebugStateChange(state) {
          onDebugStateChangeRef.current?.(state);
        },
      });
    } catch (error: unknown) {
      const previousRuntime = activeRuntimeRef.current;
      activeRuntimeRef.current = null;
      failedEffectsRef.current = effects ?? null;
      setRuntime(null);
      if (previousRuntime) {
        scheduleRuntimeDisposal(previousRuntime);
      }
      onDebugStateChangeRef.current?.(createRuntimeCreationErrorState(error));
      return;
    }

    failedEffectsRef.current = null;
    const previousRuntime = activeRuntimeRef.current;
    activeRuntimeRef.current = nextRuntime;
    setRuntime(nextRuntime);

    if (previousRuntime) {
      scheduleRuntimeDisposal(previousRuntime);
    }
  }, [effects, scrollAdapter]);

  useLayoutEffect(() => {
    return () => {
      const activeRuntime = activeRuntimeRef.current;
      activeRuntimeRef.current = null;
      activeRuntime?.dispose();
    };
  }, []);

  return createElement(
    "div",
    { ref: containerRef, className, style },
    createElement(
      "div",
      {
        "data-dom-webgl-runtime-content": "true",
        style: runtimeContentLayerStyle,
      },
      createElement(
        WebGLRuntimeProvider,
        { runtime: runtime ?? pendingRuntimeRef.current },
        children,
      ),
    ),
  );
}

function scheduleRuntimeDisposal(runtime: RuntimeInstance): void {
  setTimeout(() => {
    runtime.dispose();
  }, 0);
}

function createPendingRuntime(): RuntimeInstance {
  const container = createPendingRuntimeContainer();

  return {
    container,
    registerTarget(_element: HTMLElement, _declaration: WebGLDeclaration) {},
    unregisterTarget() {},
    sync() {},
    getDebugState() {
      return {
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
        },
        targets: [],
      };
    },
    dispose() {},
  };
}

function createRuntimeCreationErrorState(error: unknown): WebGLDebugState {
  return {
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
    },
    targets: [
      {
        key: "runtime",
        sourceKind: "runtime",
        renderRole: "overlay",
        resourceStatus: "error",
        lifecycleState: "error",
        visible: false,
        error: readErrorMessage(error),
      },
    ],
  };
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createPendingRuntimeContainer(): HTMLElement {
  if (typeof document !== "undefined") {
    return document.createElement("div");
  }

  return { tagName: "DIV" } as HTMLElement;
}
