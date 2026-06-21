# Official Smooth Scroll Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an official opt-in Lenis + GSAP ticker + ScrollTrigger stack preset while keeping `@project/dom-webgl-runtime` native-scroll-by-default and free of direct third-party scroll dependencies.

**Architecture:** Keep core runtime unchanged: it still receives only `WebGLScrollAdapter`. Add a composed stack factory in `@project/dom-webgl-scroll-adapters` that wires the existing Lenis adapter, GSAP ticker bridge, and ScrollTrigger bridge into one lifecycle object. Consumers choose between native scroll, the official smooth-scroll stack, or a custom `WebGLScrollAdapter`.

**Tech Stack:** TypeScript, Vitest, `@project/dom-webgl-runtime` public types, existing `@project/dom-webgl-scroll-adapters` helpers, Lenis structural interface, GSAP ticker structural interface, ScrollTrigger structural interface.

---

## Current Truth

- `@project/dom-webgl-runtime` already exposes `WebGLScrollAdapter` and accepts `scrollAdapter` in vanilla and React runtime options.
- `@project/dom-webgl-runtime` must not import `lenis`, `gsap`, `ScrollTrigger`, or `@project/dom-webgl-scroll-adapters`.
- `@project/dom-webgl-scroll-adapters` already exports:
  - `createLenisScrollAdapter(...)`
  - `createGsapTickerLenisBridge(...)`
  - `createScrollTriggerBridge(...)`
- Current Lenis docs still use `lenis.raf(time * 1000)` from `gsap.ticker.add(...)`, `lenis.on("scroll", ScrollTrigger.update)`, and `autoRaf: false` for manual GSAP ticker driving.
- Current GSAP docs still support `ScrollTrigger.scrollerProxy(...)`, `ScrollTrigger.update()`, and `ScrollTrigger.refresh(true)`.

## User-Facing Model

Default native scroll remains:

```tsx
<WebGLRuntime effects={runtimeEffects}>{children}</WebGLRuntime>
```

Official smooth-scroll stack becomes:

```tsx
import { WebGLRuntime } from "@project/dom-webgl-runtime/react";
import { createLenisGsapScrollStack } from "@project/dom-webgl-scroll-adapters";

const smoothScroll = createLenisGsapScrollStack({
  lenis,
  gsap,
  ScrollTrigger,
});

<WebGLRuntime
  effects={runtimeEffects}
  scrollAdapter={smoothScroll.scrollAdapter}
>
  {children}
</WebGLRuntime>;
```

Custom integration remains:

```ts
const runtime = createWebGLRuntime({
  container,
  scrollAdapter: customScrollAdapter,
});
```

## Proposed File Structure

- Create `packages/dom-webgl-scroll-adapters/src/smoothScrollStack.ts`
  - Own the composed `createLenisGsapScrollStack(...)` factory and stack types.
  - Compose existing helpers rather than duplicating Lenis/GSAP/ScrollTrigger wiring.
  - Own stack-level lifecycle: `scrollAdapter`, `update()`, `refresh(safe?)`, and `dispose()`.
- Create `packages/dom-webgl-scroll-adapters/src/smoothScrollStack.test.ts`
  - Cover default stack wiring, optional ScrollTrigger proxy, cleanup order, Lenis ownership, and no-op behavior when optional methods are absent.
- Modify `packages/dom-webgl-scroll-adapters/src/index.ts`
  - Export the new factory and public types.
- Modify `docs/agent/scroll-adapters.md`
  - Document native default, official smooth stack, and custom adapter routes.
- Modify `docs/agent/package-usage.md`
  - Add a short recommended smooth-scroll section.
- Modify `docs/examples/third-party-scroll-adapters.md`
  - Replace the manual three-helper example with the composed stack entry, while keeping a lower-level example note.
- Modify `README.md`, `docs/00-goal.md`, and `docs/EXECUTION_STATE.md`
  - Clarify that the package has an official opt-in smooth-scroll stack, but core runtime still defaults to native scroll.

## Task 1: Add Failing Tests For The Composed Stack

**Files:**
- Create: `packages/dom-webgl-scroll-adapters/src/smoothScrollStack.test.ts`

- [x] **Step 1: Write stack wiring tests**

Create `packages/dom-webgl-scroll-adapters/src/smoothScrollStack.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

import { createLenisGsapScrollStack } from "./smoothScrollStack";

describe("createLenisGsapScrollStack", () => {
  test("returns a runtime scroll adapter and wires Lenis to the GSAP ticker", () => {
    const tickerCallbacks = new Set<(time: number) => void>();
    const lenis = createFakeLenis({ scroll: 120, limit: 880 });
    const gsap = {
      ticker: {
        add: vi.fn((callback: (time: number) => void) => {
          tickerCallbacks.add(callback);
        }),
        remove: vi.fn((callback: (time: number) => void) => {
          tickerCallbacks.delete(callback);
        }),
        lagSmoothing: vi.fn(),
      },
    };
    const ScrollTrigger = {
      update: vi.fn(),
      refresh: vi.fn(),
      scrollerProxy: vi.fn(),
    };

    const stack = createLenisGsapScrollStack({
      lenis,
      gsap,
      ScrollTrigger,
      getViewportHeight: () => 500,
    });

    expect(stack.scrollAdapter.readMetrics()).toEqual({
      scrollY: 120,
      scrollHeight: 1380,
      viewportHeight: 500,
    });
    expect(gsap.ticker.add).toHaveBeenCalledTimes(1);
    expect(gsap.ticker.lagSmoothing).toHaveBeenCalledWith(0);

    for (const callback of tickerCallbacks) {
      callback(1.25);
    }

    expect(lenis.raf).toHaveBeenCalledWith(1250);

    lenis.emitScroll();
    expect(ScrollTrigger.update).toHaveBeenCalledTimes(1);

    stack.dispose();
    expect(gsap.ticker.remove).toHaveBeenCalledTimes(1);
    expect(tickerCallbacks.size).toBe(0);
  });

  test("configures ScrollTrigger scroller proxy and delegates update refresh", () => {
    const lenis = createFakeLenis();
    const gsap = createFakeGsap();
    const scroller = document.createElement("main");
    const proxy = {
      scrollTop: vi.fn(() => 25),
      getBoundingClientRect: vi.fn(() => ({
        top: 0,
        left: 0,
        width: 100,
        height: 200,
      })),
      pinType: "transform" as const,
    };
    const ScrollTrigger = {
      update: vi.fn(),
      refresh: vi.fn(),
      scrollerProxy: vi.fn(),
    };

    const stack = createLenisGsapScrollStack({
      lenis,
      gsap,
      ScrollTrigger,
      scroller,
      proxy,
    });

    expect(ScrollTrigger.scrollerProxy).toHaveBeenCalledWith(scroller, proxy);

    stack.update();
    stack.refresh(true);

    expect(ScrollTrigger.update).toHaveBeenCalledTimes(1);
    expect(ScrollTrigger.refresh).toHaveBeenCalledWith(true);
  });

  test("keeps Lenis consumer-owned by default and destroys only when requested", () => {
    const consumerOwnedLenis = createFakeLenis();
    const managedLenis = createFakeLenis();

    createLenisGsapScrollStack({
      lenis: consumerOwnedLenis,
      gsap: createFakeGsap(),
    }).dispose();

    createLenisGsapScrollStack({
      lenis: managedLenis,
      gsap: createFakeGsap(),
      manageLenis: true,
    }).dispose();

    expect(consumerOwnedLenis.destroy).not.toHaveBeenCalled();
    expect(managedLenis.destroy).toHaveBeenCalledTimes(1);
  });
});

function createFakeLenis(input: { scroll?: number; limit?: number } = {}) {
  const listeners = new Set<() => void>();

  return {
    scroll: input.scroll ?? 0,
    limit: input.limit ?? 1000,
    raf: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((_event: "scroll", listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }),
    emitScroll() {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function createFakeGsap() {
  return {
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      lagSmoothing: vi.fn(),
    },
  };
}
```

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-scroll-adapters/src/smoothScrollStack.test.ts
```

Expected: FAIL because `./smoothScrollStack` does not exist.

## Task 2: Implement The Stack Factory

**Files:**
- Create: `packages/dom-webgl-scroll-adapters/src/smoothScrollStack.ts`
- Modify: `packages/dom-webgl-scroll-adapters/src/index.ts`

- [x] **Step 1: Add the composed stack factory**

Create `packages/dom-webgl-scroll-adapters/src/smoothScrollStack.ts`:

```ts
import type { WebGLScrollAdapter } from "@project/dom-webgl-runtime";

import {
  createGsapTickerLenisBridge,
  type GsapTickerLenisBridge,
  type GsapTickerLike,
  type LenisRafLike,
} from "./gsap";
import {
  createLenisScrollAdapter,
  type LenisLike,
  type LenisScrollAdapterOptions,
} from "./lenis";
import {
  createScrollTriggerBridge,
  type ScrollTriggerBridge,
  type ScrollTriggerLike,
  type ScrollTriggerScrollerProxy,
} from "./scrollTrigger";

export type LenisGsapScrollStackLenis = LenisLike & LenisRafLike;

export type LenisGsapScrollStackOptions = {
  lenis: LenisGsapScrollStackLenis;
  gsap: GsapTickerLike;
  ScrollTrigger?: ScrollTriggerLike;
  scroller?: string | Element;
  proxy?: ScrollTriggerScrollerProxy;
  getViewportHeight?: LenisScrollAdapterOptions["getViewportHeight"];
  getScrollHeight?: LenisScrollAdapterOptions["getScrollHeight"];
  manageLenis?: boolean;
  disableLagSmoothing?: boolean;
};

export type LenisGsapScrollStack = {
  scrollAdapter: WebGLScrollAdapter;
  update(): void;
  refresh(safe?: boolean): void;
  dispose(): void;
};

export function createLenisGsapScrollStack(
  options: LenisGsapScrollStackOptions,
): LenisGsapScrollStack {
  const scrollAdapter = createLenisScrollAdapter(options.lenis, {
    getViewportHeight: options.getViewportHeight,
    getScrollHeight: options.getScrollHeight,
    manageInstance: options.manageLenis,
  });
  const scrollTriggerBridge = createOptionalScrollTriggerBridge(options);
  const tickerBridge = createGsapTickerLenisBridge({
    gsap: options.gsap,
    lenis: options.lenis,
    scrollTrigger: options.ScrollTrigger,
    disableLagSmoothing: options.disableLagSmoothing,
  });

  return {
    scrollAdapter,
    update() {
      scrollTriggerBridge?.update();
    },
    refresh(safe?: boolean) {
      scrollTriggerBridge?.refresh(safe);
    },
    dispose() {
      tickerBridge.dispose();
      scrollTriggerBridge?.dispose();
      scrollAdapter.dispose?.();
    },
  };
}

function createOptionalScrollTriggerBridge(
  options: LenisGsapScrollStackOptions,
): ScrollTriggerBridge | null {
  if (!options.ScrollTrigger) {
    return null;
  }

  return createScrollTriggerBridge({
    ScrollTrigger: options.ScrollTrigger,
    scroller: options.scroller,
    proxy: options.proxy,
  });
}
```

- [x] **Step 2: Export the new entrypoint from the adapter package**

Modify `packages/dom-webgl-scroll-adapters/src/index.ts`:

```ts
export {
  createGsapTickerLenisBridge,
  type GsapTickerLenisBridge,
  type GsapTickerLenisBridgeOptions,
  type GsapTickerLike,
  type LenisRafLike,
  type ScrollTriggerUpdateLike,
} from "./gsap";
export {
  createLenisScrollAdapter,
  type LenisLike,
  type LenisScrollAdapterOptions,
} from "./lenis";
export {
  createLenisGsapScrollStack,
  type LenisGsapScrollStack,
  type LenisGsapScrollStackLenis,
  type LenisGsapScrollStackOptions,
} from "./smoothScrollStack";
export {
  createScrollTriggerBridge,
  type ScrollTriggerBridge,
  type ScrollTriggerBridgeOptions,
  type ScrollTriggerLike,
  type ScrollTriggerScrollerProxy,
} from "./scrollTrigger";
```

- [x] **Step 3: Run focused tests and verify they pass**

Run:

```bash
npm test -- --run packages/dom-webgl-scroll-adapters/src/smoothScrollStack.test.ts packages/dom-webgl-scroll-adapters/src/gsap.test.ts packages/dom-webgl-scroll-adapters/src/lenis.test.ts packages/dom-webgl-scroll-adapters/src/scrollTrigger.test.ts
```

Expected: PASS. The new stack test and the existing helper tests all pass.

- [x] **Step 4: Commit the stack factory**

Run:

```bash
git add packages/dom-webgl-scroll-adapters/src/smoothScrollStack.ts packages/dom-webgl-scroll-adapters/src/smoothScrollStack.test.ts packages/dom-webgl-scroll-adapters/src/index.ts
git commit -m "feat: add official smooth scroll stack"
```

## Task 3: Document Native Default, Official Stack, And Custom Adapter Routes

**Files:**
- Modify: `docs/agent/scroll-adapters.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/examples/third-party-scroll-adapters.md`

- [x] **Step 1: Update `docs/agent/scroll-adapters.md`**

Replace the `## Runtime Integration` section with:

````md
## Runtime Integration

There are three supported routes.

### 1. Native Default

Native browser scroll needs no adapter:

```tsx
<WebGLRuntime effects={runtimeEffects}>{children}</WebGLRuntime>
```

This remains the default for `@project/dom-webgl-runtime`.

### 2. Official Smooth Scroll Stack

Use `createLenisGsapScrollStack(...)` when the application wants the recommended
Lenis + GSAP ticker + ScrollTrigger bridge.

```tsx
import { WebGLRuntime } from "@project/dom-webgl-runtime/react";
import { createLenisGsapScrollStack } from "@project/dom-webgl-scroll-adapters";

const smoothScroll = createLenisGsapScrollStack({
  lenis,
  gsap,
  ScrollTrigger,
});

<WebGLRuntime effects={runtimeEffects} scrollAdapter={smoothScroll.scrollAdapter}>
  {children}
</WebGLRuntime>;
```

When Lenis is manually driven by the GSAP ticker, configure Lenis with
`autoRaf: false` in the application-owned Lenis setup.

### 3. Custom Adapter

Use a custom `WebGLScrollAdapter` when the application owns another scroll
system or needs a different lifecycle.

```ts
const runtime = createWebGLRuntime({
  container,
  scrollAdapter: customScrollAdapter,
});
```
````

- [x] **Step 2: Add package usage guidance**

Add this section after `## Scroll Adapter Setup` in `docs/agent/package-usage.md`:

````md
### Official Smooth Scroll Stack

The recommended third-party route is the opt-in Lenis + GSAP ticker +
ScrollTrigger stack from `<scroll-adapters-package>`.

```ts
import { createLenisGsapScrollStack } from "<scroll-adapters-package>";

const smoothScroll = createLenisGsapScrollStack({
  lenis,
  gsap,
  ScrollTrigger,
});

const runtime = createWebGLRuntime({
  container,
  scrollAdapter: smoothScroll.scrollAdapter,
});
```

Rules:

- This stack is not the core runtime default; native scroll remains the default
  when `scrollAdapter` is omitted.
- Configure Lenis with `autoRaf: false` when GSAP drives `lenis.raf(...)`.
- Call `smoothScroll.dispose()` from the application lifecycle.
- Use `smoothScroll.refresh(true)` after layout changes that should force
  ScrollTrigger to recalculate positions.
````

- [x] **Step 3: Replace the example with the composed stack**

Replace the main code block in `docs/examples/third-party-scroll-adapters.md` with:

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

- [x] **Step 4: Commit docs**

Run:

```bash
git add docs/agent/scroll-adapters.md docs/agent/package-usage.md docs/examples/third-party-scroll-adapters.md
git commit -m "docs: document official smooth scroll stack"
```

## Task 4: Align Status Docs And Public Boundaries

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Update README current behavior**

In `README.md`, keep the current statement that core does not directly depend on third-party scroll libraries, and add:

```md
The optional scroll adapters package also exposes an official
`createLenisGsapScrollStack(...)` convenience entry for the recommended Lenis +
GSAP ticker + ScrollTrigger wiring. It is opt-in; omitting `scrollAdapter` still
uses native browser scroll.
```

- [x] **Step 2: Update goal docs**

In `docs/00-goal.md`, under `Delivered third-party adapter boundary`, add:

```md
- `@project/dom-webgl-scroll-adapters` provides
  `createLenisGsapScrollStack(...)` as the recommended opt-in stack for
  applications that want Lenis + GSAP ticker + ScrollTrigger wiring.
- This stack does not change the core default: no `scrollAdapter` means native
  browser scroll.
```

- [x] **Step 3: Update execution state**

In `docs/EXECUTION_STATE.md`, update `Latest Documentation Note` with:

```md
The optional adapter package now exposes an official
`createLenisGsapScrollStack(...)` entry that composes Lenis metrics, GSAP ticker
driving, and ScrollTrigger update/refresh/proxy bridging. Core runtime still
defaults to native page/gate scroll and receives only a `WebGLScrollAdapter`.
```

- [ ] **Step 4: Commit status docs**

Run:

```bash
git add README.md docs/00-goal.md docs/EXECUTION_STATE.md
git commit -m "docs: align smooth scroll stack status"
```

## Task 5: Full Verification And Boundary Sweep

**Files:**
- All changed package and docs files.

- [ ] **Step 1: Run focused adapter tests**

Run:

```bash
npm test -- --run packages/dom-webgl-scroll-adapters/src
```

Expected: PASS. The stack factory and lower-level helper tests pass.

- [ ] **Step 2: Run runtime scroll regression tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx
```

Expected: PASS. Core runtime still accepts adapters and native behavior remains covered.

- [ ] **Step 3: Run typecheck and import boundary checks**

Run:

```bash
npm run typecheck
npm run check:imports
```

Expected: PASS. The adapter package type-checks and demo imports still use public package APIs.

- [ ] **Step 4: Sweep for forbidden core coupling**

Run:

```bash
rg -n "from [\"'](lenis|gsap)|from [\"']@project/dom-webgl-scroll-adapters|ScrollTrigger" packages/dom-webgl-runtime/src apps/demo/src
```

Expected: no matches in `packages/dom-webgl-runtime/src`. Matches in docs or `packages/dom-webgl-scroll-adapters/src` are acceptable; matches in `apps/demo/src` require review because the default demo must not require Lenis, GSAP, or ScrollTrigger.

- [ ] **Step 5: Run full workspace verification**

Run:

```bash
npm test -- --run
npm run build
git diff --check
```

Expected: all commands exit 0. Existing Vite chunk-size warning remains acceptable if unchanged.

- [ ] **Step 6: Commit verification-driven fixes if needed**

If verification surfaces a real issue, fix only the failing scope and commit:

```bash
git add packages/dom-webgl-scroll-adapters docs README.md
git commit -m "fix: harden smooth scroll stack"
```

If no fixes are needed after Task 4, skip this commit.

## Acceptance Criteria

- `@project/dom-webgl-runtime` default behavior remains native browser scroll when `scrollAdapter` is omitted.
- `@project/dom-webgl-runtime` does not import Lenis, GSAP, ScrollTrigger, or the scroll adapters package.
- `@project/dom-webgl-scroll-adapters` exports `createLenisGsapScrollStack(...)`.
- The official stack returns a stable `scrollAdapter` plus `update()`, `refresh(safe?)`, and `dispose()`.
- The official stack wires GSAP ticker to `lenis.raf(time * 1000)`.
- The official stack wires Lenis scroll events to `ScrollTrigger.update()` when ScrollTrigger is provided.
- The official stack supports optional `scrollerProxy(...)` when `scroller` and `proxy` are provided.
- The official stack keeps Lenis consumer-owned by default and destroys it only with `manageLenis: true`.
- Docs clearly present three routes: native default, official smooth-scroll stack, custom adapter.
- Tests cover stack composition, cleanup, ownership, public exports, runtime adapter regression, and import boundaries.

## Self-Review Notes

- Spec coverage: the plan covers the requested official default stack as an opt-in preset, preserves native core default, and keeps custom adapter support.
- Placeholder scan: no deferred implementation placeholders are intentionally left in the task steps.
- Type consistency: `createLenisGsapScrollStack`, `LenisGsapScrollStackOptions`, `LenisGsapScrollStack`, and `LenisGsapScrollStackLenis` are introduced once and reused consistently.
