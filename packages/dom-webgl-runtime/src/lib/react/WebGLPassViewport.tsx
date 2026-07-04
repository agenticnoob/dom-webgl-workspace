import {
  createElement,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";

import { WebGLPassViewportContext } from "./passViewportContext";
import { useWebGLRuntime } from "./useWebGLRuntime";

export type WebGLPassViewportProps<TElement extends ElementType = "div"> = {
  id: string;
  as?: TElement;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<TElement>, "as" | "id">;

export function WebGLPassViewport<TElement extends ElementType = "div">({
  id,
  as,
  children,
  ...props
}: WebGLPassViewportProps<TElement>) {
  const runtime = useWebGLRuntime();
  const elementRef = useRef<HTMLElement | null>(null);
  const Component = as ?? "div";
  const anchorId = id.trim();

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    runtime.registerPassViewport({ id, element });
    return () => {
      runtime.unregisterPassViewport(anchorId);
    };
  }, [runtime, id, anchorId]);

  return createElement(
    WebGLPassViewportContext.Provider,
    { value: anchorId },
    createElement(
      Component,
      {
        ...props,
        ref: (element: HTMLElement | null) => {
          elementRef.current = element;
        },
      },
      children,
    ),
  );
}
