import { WebGLRuntime, type WebGLRuntimeProps } from "@project/dom-webgl-runtime/react";
import {
  createContext,
  createElement,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import {
  createScrollEffectProgressStore,
  type ScrollEffectProgressStore,
} from "./scrollEffectProgress";
import {
  createScrollTriggerSection,
  type ScrollTriggerSectionCreator,
  type ScrollTriggerSectionVars,
} from "./scrollTrigger";
import {
  createLenisGsapScrollStack,
  type LenisGsapScrollStack,
  type LenisGsapScrollStackLenis,
  type LenisGsapScrollStackOptions,
} from "./smoothScrollStack";

export {
  createScrollEffectProgressStore,
  type ScrollEffectProgressStore,
} from "./scrollEffectProgress";

type ScrollEffectProgressContextValue = {
  readonly store: ScrollEffectProgressStore;
  readonly ScrollTrigger?: ScrollTriggerSectionCreator;
};

export type WebGLScrollSmoothOptions = Omit<
  LenisGsapScrollStackOptions,
  "lenis" | "manageLenis"
> & {
  readonly createLenis: () => LenisGsapScrollStackLenis;
  readonly ScrollTrigger?: ScrollTriggerSectionCreator;
};

export type WebGLScrollRuntimeProps = Omit<
  WebGLRuntimeProps,
  "progressSignals"
> & {
  readonly smooth?: false | WebGLScrollSmoothOptions;
};

export type ScrollEffectSectionProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> & {
  readonly as?: keyof HTMLElementTagNameMap;
  readonly progressKey: string;
  readonly children?: ReactNode;
  readonly start?: ScrollTriggerSectionVars["start"];
  readonly end?: ScrollTriggerSectionVars["end"];
  readonly pin?: ScrollTriggerSectionVars["pin"];
  readonly scrub?: ScrollTriggerSectionVars["scrub"];
  readonly ScrollTrigger?: ScrollTriggerSectionCreator;
};

const ScrollEffectProgressContext =
  createContext<ScrollEffectProgressContextValue | null>(null);

export function WebGLScrollRuntime({
  children,
  smooth,
  scrollAdapter,
  ...runtimeProps
}: WebGLScrollRuntimeProps) {
  const store = useStableProgressStore();
  const smoothStack = useSmoothScrollStack(smooth, scrollAdapter);
  const activeScrollAdapter = scrollAdapter ?? smoothStack?.scrollAdapter;
  const contextValue = useStableContextValue(store, smooth);

  return createElement(
    ScrollEffectProgressContext.Provider,
    { value: contextValue },
    createElement(
      WebGLRuntime,
      {
        ...runtimeProps,
        progressSignals: store.source,
        scrollAdapter: activeScrollAdapter,
      },
      children,
    ),
  );
}

export function ScrollEffectSection({
  as,
  children,
  progressKey,
  start = "top bottom",
  end = "bottom top",
  pin,
  scrub = true,
  ScrollTrigger,
  ...props
}: ScrollEffectSectionProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const context = useRequiredScrollEffectProgressContext();
  const activeScrollTrigger = ScrollTrigger ?? context.ScrollTrigger;

  useLayoutEffect(() => {
    const element = elementRef.current;

    if (!element || !activeScrollTrigger) {
      return;
    }

    const section = createScrollTriggerSection({
      ScrollTrigger: activeScrollTrigger,
      trigger: element,
      start,
      end,
      pin,
      scrub,
      onUpdate(state) {
        context.store.set(progressKey, state.progress);
      },
    });

    return () => {
      section.kill();
      context.store.clear(progressKey);
    };
  }, [
    activeScrollTrigger,
    context.store,
    end,
    pin,
    progressKey,
    scrub,
    start,
  ]);

  return createElement(as ?? "section", { ...props, ref: elementRef }, children);
}

export function useScrollEffectProgressStore(): ScrollEffectProgressStore {
  return useRequiredScrollEffectProgressContext().store;
}

function useStableProgressStore(): ScrollEffectProgressStore {
  const storeRef = useRef<ScrollEffectProgressStore | null>(null);

  if (storeRef.current === null) {
    storeRef.current = createScrollEffectProgressStore();
  }

  return storeRef.current;
}

function useStableContextValue(
  store: ScrollEffectProgressStore,
  smooth: WebGLScrollRuntimeProps["smooth"],
): ScrollEffectProgressContextValue {
  const valueRef = useRef<ScrollEffectProgressContextValue | null>(null);
  const ScrollTrigger = smooth ? smooth.ScrollTrigger : undefined;

  if (
    valueRef.current === null ||
    valueRef.current.store !== store ||
    valueRef.current.ScrollTrigger !== ScrollTrigger
  ) {
    valueRef.current = {
      store,
      ScrollTrigger,
    };
  }

  return valueRef.current;
}

function useSmoothScrollStack(
  smooth: WebGLScrollRuntimeProps["smooth"],
  scrollAdapter: WebGLRuntimeProps["scrollAdapter"],
): LenisGsapScrollStack | null {
  const [smoothStack, setSmoothStack] = useState<LenisGsapScrollStack | null>(null);

  useLayoutEffect(() => {
    if (!smooth || scrollAdapter) {
      setSmoothStack(null);
      return;
    }

    const stack = createLenisGsapScrollStack({
      ...smooth,
      lenis: smooth.createLenis(),
      manageLenis: true,
    });

    setSmoothStack(stack);

    return () => {
      setSmoothStack((currentStack) => (currentStack === stack ? null : currentStack));
      stack.dispose();
    };
  }, [scrollAdapter, smooth]);

  return smoothStack;
}

function useRequiredScrollEffectProgressContext(): ScrollEffectProgressContextValue {
  const context = useContext(ScrollEffectProgressContext);

  if (context === null) {
    throw new Error("ScrollEffectSection must be rendered inside WebGLScrollRuntime.");
  }

  return context;
}
