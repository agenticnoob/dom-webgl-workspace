# Third-Party Scroll Adapter Example

This example shows the package boundary. It is intentionally docs-only so the
default demo does not depend on Lenis, GSAP, or ScrollTrigger.

```tsx
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import type { WebGLRuntimeOptions } from "@project/dom-webgl-runtime";
import { WebGLRuntime } from "@project/dom-webgl-runtime/react";
import { createLenisGsapScrollStack } from "@project/dom-webgl-scroll-adapters";

export function AppScrollRuntime({
  children,
  gsap,
  lenis,
  ScrollTrigger,
  runtimeEffects,
}: {
  children: ReactNode;
  gsap: {
    ticker: {
      add(callback: (time: number) => void): void;
      remove(callback: (time: number) => void): void;
      lagSmoothing?(threshold: number): void;
    };
  };
  lenis: {
    scroll?: number;
    limit?: number;
    raf(time: number): void;
    on?(event: "scroll", listener: () => void): void | (() => void);
  };
  ScrollTrigger?: {
    update(): void;
    refresh(safe?: boolean): void;
    scrollerProxy?(
      scroller: string | Element,
      proxy: {
        scrollTop?(value?: number): number | void;
        scrollLeft?(value?: number): number | void;
        getBoundingClientRect?(): {
          top: number;
          left: number;
          width: number;
          height: number;
        };
        pinType?: "fixed" | "transform";
      },
    ): void;
  };
  runtimeEffects: WebGLRuntimeOptions["effects"];
}) {
  const smoothScroll = useMemo(
    () =>
      createLenisGsapScrollStack({
        lenis,
        gsap,
        ScrollTrigger,
        getViewportHeight: () => window.innerHeight,
      }),
    [gsap, lenis, ScrollTrigger],
  );

  useEffect(() => {
    return () => smoothScroll.dispose();
  }, [smoothScroll]);

  return (
    <WebGLRuntime
      effects={runtimeEffects}
      scrollAdapter={smoothScroll.scrollAdapter}
    >
      {children}
    </WebGLRuntime>
  );
}
```

Rules:

- Keep `smoothScroll.scrollAdapter` stable for the lifetime of the runtime.
- Dispose the stack from the surrounding app lifecycle when its Lenis or GSAP
  instances change.
- Keep app-specific triggers and timelines outside the runtime package.
