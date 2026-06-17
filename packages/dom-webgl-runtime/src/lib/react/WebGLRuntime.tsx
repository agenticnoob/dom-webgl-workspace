import {
  createElement,
  useEffect,
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
} from "../types";

import { WebGLRuntimeProvider } from "./runtimeContext";

export type WebGLRuntimeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onDebugStateChange?: (state: WebGLDebugState) => void;
};

export function WebGLRuntime({
  children,
  className,
  style,
  onDebugStateChange,
}: WebGLRuntimeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingRuntimeRef = useRef<RuntimeInstance | null>(null);
  const onDebugStateChangeRef = useRef(onDebugStateChange);
  const [runtime, setRuntime] = useState<RuntimeInstance | null>(null);

  onDebugStateChangeRef.current = onDebugStateChange;

  if (pendingRuntimeRef.current === null) {
    pendingRuntimeRef.current = createPendingRuntime();
  }

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const nextRuntime = createWebGLRuntime({
      container,
      onDebugStateChange(state) {
        onDebugStateChangeRef.current?.(state);
      },
    });

    setRuntime(nextRuntime);

    return () => {
      nextRuntime.dispose();
    };
  }, []);

  return createElement(
    "div",
    { ref: containerRef, className, style },
    createElement(
      WebGLRuntimeProvider,
      { runtime: runtime ?? pendingRuntimeRef.current },
      children,
    ),
  );
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

function createPendingRuntimeContainer(): HTMLElement {
  if (typeof document !== "undefined") {
    return document.createElement("div");
  }

  return { tagName: "DIV" } as HTMLElement;
}
