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

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    runtime.registerTarget(element, webgl);

    return () => {
      runtime.unregisterTarget(webgl.key);
    };
  }, [runtime, webgl]);

  return createElement(as ?? "div", { ...props, ref: elementRef }, children);
}
