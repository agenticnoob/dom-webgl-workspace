# Third-Party Scroll Adapter Examples

Use the smallest integration level that fits the product behavior.

## Plain Runtime

No adapter is required for normal browser scrolling:

```tsx
import type { ReactNode } from "react";
import type { WebGLRuntimeOptions } from "@project/dom-webgl-runtime";
import { WebGLRuntime } from "@project/dom-webgl-runtime/react";

export function AppRuntime({ children, runtimeEffects }: {
  children: ReactNode;
  runtimeEffects: WebGLRuntimeOptions["effects"];
}) {
  return <WebGLRuntime effects={runtimeEffects}>{children}</WebGLRuntime>;
}
```

## High-Level Pinned Scroll React Adapter

Use `@project/dom-webgl-scroll-adapters/react` for a pinned section whose
progress drives a WebGL effect. The React adapter owns the bounded trigger
instance and writes keyed progress into the runtime.

```tsx
import type { ReactNode } from "react";
import type { WebGLRuntimeOptions } from "@project/dom-webgl-runtime";
import { WebGLTarget } from "@project/dom-webgl-runtime/react";
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "@project/dom-webgl-scroll-adapters/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function PinnedRuntime({
  children,
  runtimeEffects,
}: {
  children: ReactNode;
  runtimeEffects: WebGLRuntimeOptions["effects"];
}) {
  return (
    <WebGLScrollRuntime effects={runtimeEffects} smooth={false}>
      <ScrollEffectSection
        progressKey="example.pinned.reveal"
        ScrollTrigger={ScrollTrigger}
        pin
        scrub
      >
        <WebGLTarget
          webgl={{
            key: "example.pinned.surface",
            source: { kind: "snapshot", mode: "element" },
            effects: [
              {
                kind: "example.pinnedReveal",
                progressKey: "example.pinned.reveal",
              },
            ],
          }}
        >
          {children}
        </WebGLTarget>
      </ScrollEffectSection>
    </WebGLScrollRuntime>
  );
}
```

The matching effect reads `ctx.progress.get("example.pinned.reveal")`. This is
not a scene gate; the runtime remains in page scroll mode.
If `WebGLScrollRuntime` receives `smooth` options that include `ScrollTrigger`,
child `ScrollEffectSection` components can inherit it from context and omit the
per-section `ScrollTrigger` prop. `apps/example` uses that centralized path.

## Advanced Manual `scrollAdapter`

Use the low-level adapter stack when the app intentionally owns Lenis, GSAP, or
ScrollTrigger lifecycle details. This example shows the package boundary used by
the demo when it opts into the official Lenis + GSAP ticker + ScrollTrigger
stack.

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
- With low-level helpers, keep app-specific triggers and timelines outside the
  runtime package. Use `ScrollEffectSection` when you want the adapter React
  layer to own one bounded pinned trigger for section progress.
