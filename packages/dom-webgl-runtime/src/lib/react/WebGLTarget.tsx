import {
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import type { WebGLDeclaration } from "../types";
import { markManagedFallbackRoot } from "../dom/fallbackBoundary";

import { WebGLSceneContext } from "./sceneContext";
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
  const inheritedSceneId = useContext(WebGLSceneContext);
  const effectiveWebgl = useMemo(
    () =>
      inheritedSceneId && webgl.sceneId === undefined
        ? { ...webgl, sceneId: inheritedSceneId }
        : webgl,
    [inheritedSceneId, webgl],
  );
  const elementRef = useRef<HTMLElement | null>(null);
  const webglRef = useRef(effectiveWebgl);
  const unmarkFallbackRootRef = useRef<(() => void) | undefined>(undefined);

  webglRef.current = effectiveWebgl;

  const setElementRef = useCallback(
    (element: HTMLElement | null) => {
      unmarkFallbackRootRef.current?.();
      unmarkFallbackRootRef.current = undefined;
      elementRef.current = element;

      if (element) {
        unmarkFallbackRootRef.current = markManagedFallbackRoot(
          element,
          effectiveWebgl.key,
        );
      }
    },
    [effectiveWebgl.key],
  );

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    runtime.registerTarget(element, webglRef.current);

    return () => {
      runtime.unregisterTarget(effectiveWebgl.key);
    };
  }, [runtime, effectiveWebgl.key]);

  return createElement(as ?? "div", { ...props, ref: setElementRef }, children);
}
