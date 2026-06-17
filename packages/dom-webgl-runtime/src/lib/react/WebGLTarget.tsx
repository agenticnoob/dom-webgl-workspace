import {
  createElement,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import type { WebGLDeclaration } from "../types";

import { useWebGLRuntime } from "./useWebGLRuntime";

type WebGLTargetElement = keyof HTMLElementTagNameMap;

export type WebGLTargetProps<TElement extends WebGLTargetElement = "div"> = {
  as?: TElement;
  webgl: WebGLDeclaration;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<TElement>, "as" | "children">;

export function WebGLTarget<TElement extends WebGLTargetElement = "div">({
  as,
  webgl,
  children,
  ...props
}: WebGLTargetProps<TElement>) {
  const runtime = useWebGLRuntime();
  const elementRef = useRef<HTMLElement | null>(null);
  const webglRef = useRef(webgl);

  webglRef.current = webgl;

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    runtime.registerTarget(element, webglRef.current);

    return () => {
      runtime.unregisterTarget(webgl.key);
    };
  }, [runtime, webgl.key]);

  return createElement(as ?? "div", { ...props, ref: elementRef }, children);
}
