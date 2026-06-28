import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import type { WebGLDeclaration } from "../types";
import { markManagedFallbackRoot } from "../dom/fallbackBoundary";

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
  const unmarkFallbackRootRef = useRef<(() => void) | undefined>(undefined);

  webglRef.current = webgl;

  const setElementRef = useCallback(
    (element: HTMLElement | null) => {
      unmarkFallbackRootRef.current?.();
      unmarkFallbackRootRef.current = undefined;
      elementRef.current = element;

      if (element) {
        unmarkFallbackRootRef.current = markManagedFallbackRoot(
          element,
          webgl.key,
        );
      }
    },
    [webgl.key],
  );

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    runtime.registerTarget(element, webglRef.current);

    return () => {
      runtime.unregisterTarget(webgl.key);
      unmarkFallbackRootRef.current?.();
      unmarkFallbackRootRef.current = undefined;
    };
  }, [runtime, webgl.key]);

  return createElement(as ?? "div", { ...props, ref: setElementRef }, children);
}
