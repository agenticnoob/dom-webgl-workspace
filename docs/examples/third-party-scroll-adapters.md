# Third-Party Scroll Adapter Example

This example shows the package boundary. It is intentionally docs-only so the
default demo does not depend on Lenis, GSAP, or ScrollTrigger.

```tsx
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import type { WebGLRuntimeOptions } from "@project/dom-webgl-runtime";
import { WebGLRuntime } from "@project/dom-webgl-runtime/react";
import {
  createGsapTickerLenisBridge,
  createLenisScrollAdapter,
} from "@project/dom-webgl-scroll-adapters";

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
  ScrollTrigger?: { update(): void };
  runtimeEffects: WebGLRuntimeOptions["effects"];
}) {
  const scrollAdapter = useMemo(
    () =>
      createLenisScrollAdapter(lenis, {
        getViewportHeight: () => window.innerHeight,
      }),
    [lenis],
  );

  useEffect(() => {
    const bridge = createGsapTickerLenisBridge({
      gsap,
      lenis,
      scrollTrigger: ScrollTrigger,
    });

    return () => bridge.dispose();
  }, [gsap, lenis, ScrollTrigger]);

  return (
    <WebGLRuntime effects={runtimeEffects} scrollAdapter={scrollAdapter}>
      {children}
    </WebGLRuntime>
  );
}
```

Rules:

- Keep `scrollAdapter` stable for the lifetime of the runtime.
- Dispose bridge objects from the surrounding app lifecycle when their Lenis or
  GSAP instances change.
- Keep app-specific triggers and timelines outside the runtime package.
