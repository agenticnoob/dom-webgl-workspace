import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  createWebGLRuntime,
  type WebGLRuntime as RuntimeInstance,
} from "../renderer/runtime";
import type { WebGLDebugState } from "../types";

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
  const [runtime, setRuntime] = useState<RuntimeInstance | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const nextRuntime = createWebGLRuntime({
      container,
      onDebugStateChange,
    });

    setRuntime(nextRuntime);

    return () => {
      nextRuntime.dispose();
    };
  }, [onDebugStateChange]);

  return createElement(
    "div",
    { ref: containerRef, className, style },
    runtime === null
      ? null
      : createElement(WebGLRuntimeProvider, { runtime }, children),
  );
}
