# Lenis Smooth Scroll Lifecycle Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Simplify the demo Lenis + GSAP ticker + ScrollTrigger setup so Lenis reliably owns wheel smoothing in React dev/StrictMode without bespoke generation guards or module-level active-instance repair.

**Implementation status:** Completed on `2026-06-22`. The demo smooth-scroll lifecycle now lives in `apps/demo/src/useDemoSmoothScrollStack.ts`, Lenis remains app-owned with `manageLenis: false`, App-level tests no longer assert hook internals, focused hook tests cover StrictMode lifecycle behavior, browser verification confirmed Lenis owns wheel input, and workspace verification passed.

**Architecture:** Keep `@project/dom-webgl-runtime` and `@project/dom-webgl-scroll-adapters` unchanged. Move demo-owned smooth-scroll lifecycle into a focused hook that creates Lenis, composes the adapter stack, and destroys both in one place. The adapter stack remains low-coupling: it receives an app-owned Lenis instance and does not own the instance lifetime.

**Tech Stack:** React, TypeScript, Lenis, GSAP ticker, ScrollTrigger, Vitest, Vite demo app.

---

## File Structure

- Modify: `apps/demo/src/App.tsx`
  - Remove inline `useDemoSmoothScrollStack` implementation and demo-specific module state.
  - Import the new hook.
- Create: `apps/demo/src/useDemoSmoothScrollStack.ts`
  - Own the demo Lenis instance lifecycle.
  - Compose `createLenisGsapScrollStack(...)`.
  - Return `LenisGsapScrollStack | null`.
- Create: `apps/demo/src/useDemoSmoothScrollStack.test.tsx`
  - Test StrictMode lifecycle with a mocked Lenis class.
  - Verify the final active Lenis instance leaves `html.lenis` active.
  - Verify app-owned cleanup destroys Lenis once.
- Modify: `apps/demo/src/App.test.tsx`
  - Keep only App-level behavior assertions.
  - Remove Lenis constructor mock and StrictMode smooth-scroll internals from App tests.
- Modify: `apps/demo/src/demoCss.test.ts`
  - Keep the `lenis/dist/lenis.css` import guard.
- Modify: `docs/agent/scroll-adapters.md`
  - Document the simple ownership rule: app creates Lenis, app destroys Lenis; stack disposes bridge hooks only.

---

### Task 1: Add Focused Hook Tests

**Files:**
- Create: `apps/demo/src/useDemoSmoothScrollStack.test.tsx`

- [x] **Step 1: Write the failing StrictMode lifecycle test**

Create `apps/demo/src/useDemoSmoothScrollStack.test.tsx` with:

```tsx
import { StrictMode, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const lenisInstances: MockLenis[] = [];

class MockLenis {
  readonly scroll = 0;
  readonly limit = 1000;
  readonly raf = vi.fn();
  readonly destroy = vi.fn(() => {
    document.documentElement.classList.remove("lenis");
  });
  readonly on = vi.fn((_event: "scroll", _listener: () => void) => () => {});

  constructor(readonly options: unknown) {
    lenisInstances.push(this);
    document.documentElement.classList.add("lenis");
  }
}

vi.mock("lenis", () => ({
  default: MockLenis,
}));

function Harness() {
  const smoothScroll = useDemoSmoothScrollStack();

  return createElement("div", {
    "data-ready": smoothScroll ? "true" : "false",
  });
}

describe("useDemoSmoothScrollStack", () => {
  const roots: Root[] = [];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    lenisInstances.length = 0;
    document.documentElement.className = "";
    document.body.replaceChildren();
  });

  test("keeps the final Lenis instance active under StrictMode", async () => {
    const { useDemoSmoothScrollStack } = await import("./useDemoSmoothScrollStack");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(Harness)));
    });
    await flushFrame();

    expect(host.firstElementChild?.getAttribute("data-ready")).toBe("true");
    expect(document.documentElement.classList.contains("lenis")).toBe(true);
    expect(lenisInstances.at(-1)?.options).toMatchObject({
      autoRaf: false,
      lerp: 0.055,
      smoothWheel: true,
      touchMultiplier: 1,
      wheelMultiplier: 0.85,
    });
    expect(lenisInstances.at(-1)?.destroy).not.toHaveBeenCalled();
  });

  test("destroys the app-owned Lenis instance on unmount", async () => {
    const { useDemoSmoothScrollStack } = await import("./useDemoSmoothScrollStack");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(Harness));
    });
    await flushFrame();

    const activeLenis = lenisInstances.at(-1);

    act(() => {
      root.unmount();
    });
    roots.pop();

    expect(activeLenis?.destroy).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("lenis")).toBe(false);
  });
});

async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
}
```

- [x] **Step 2: Fix the import ordering in the new test**

The `Harness` component references `useDemoSmoothScrollStack`; keep the dynamic import inside each test by changing `Harness` to accept the hook as a prop:

```tsx
import type { LenisGsapScrollStack } from "@project/dom-webgl-scroll-adapters";

type SmoothScrollHook = () => LenisGsapScrollStack | null;

function Harness({ useHook }: { useHook: SmoothScrollHook }) {
  const smoothScroll = useHook();

  return createElement("div", {
    "data-ready": smoothScroll ? "true" : "false",
  });
}
```

Then render with:

```tsx
const { useDemoSmoothScrollStack } = await import("./useDemoSmoothScrollStack");

root.render(
  createElement(
    StrictMode,
    null,
    createElement(Harness, { useHook: useDemoSmoothScrollStack }),
  ),
);
```

and:

```tsx
root.render(createElement(Harness, { useHook: useDemoSmoothScrollStack }));
```

- [x] **Step 3: Run the failing test**

Run:

```bash
npm test -- --run apps/demo/src/useDemoSmoothScrollStack.test.tsx
```

Expected: FAIL because `apps/demo/src/useDemoSmoothScrollStack.ts` does not exist yet.

---

### Task 2: Extract the Demo Smooth Scroll Hook

**Files:**
- Create: `apps/demo/src/useDemoSmoothScrollStack.ts`
- Modify: `apps/demo/src/App.tsx`

- [x] **Step 1: Create the hook module**

Create `apps/demo/src/useDemoSmoothScrollStack.ts`:

```ts
import { useLayoutEffect, useState } from "react";
import {
  createLenisGsapScrollStack,
  type LenisGsapScrollStack,
} from "@project/dom-webgl-scroll-adapters";
import gsap from "gsap";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

export function useDemoSmoothScrollStack(): LenisGsapScrollStack | null {
  const [smoothScroll, setSmoothScroll] = useState<LenisGsapScrollStack | null>(null);

  useLayoutEffect(() => {
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.055,
      smoothWheel: true,
      touchMultiplier: 1,
      wheelMultiplier: 0.85,
    });
    const smoothScrollStack = createLenisGsapScrollStack({
      lenis,
      gsap,
      ScrollTrigger,
      getViewportHeight: () => window.innerHeight,
      manageLenis: false,
    });

    setSmoothScroll(smoothScrollStack);

    return () => {
      setSmoothScroll((currentSmoothScroll) =>
        currentSmoothScroll === smoothScrollStack ? null : currentSmoothScroll,
      );
      smoothScrollStack.dispose();
      lenis.destroy();
    };
  }, []);

  return smoothScroll;
}
```

- [x] **Step 2: Update App imports**

In `apps/demo/src/App.tsx`, remove these imports:

```ts
import { useLayoutEffect, useRef, useState } from "react";
import {
  createLenisGsapScrollStack,
  type LenisGsapScrollStack,
} from "@project/dom-webgl-scroll-adapters";
import gsap from "gsap";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";
```

Replace them with:

```ts
import { useState } from "react";
import { useDemoSmoothScrollStack } from "./useDemoSmoothScrollStack";
```

- [x] **Step 3: Remove inline lifecycle code from App**

Delete from `apps/demo/src/App.tsx`:

```ts
let activeDemoLenis: Lenis | null = null;

gsap.registerPlugin(ScrollTrigger);
```

Delete the full inline `useDemoSmoothScrollStack()` function from `apps/demo/src/App.tsx`.

- [x] **Step 4: Run the hook test**

Run:

```bash
npm test -- --run apps/demo/src/useDemoSmoothScrollStack.test.tsx
```

Expected: PASS.

---

### Task 3: Clean Up App Tests

**Files:**
- Modify: `apps/demo/src/App.test.tsx`

- [x] **Step 1: Remove Lenis internals from App test**

Remove from `apps/demo/src/App.test.tsx`:

```ts
StrictMode,
```

Remove:

```ts
const lenisConstructorOptions: unknown[] = [];
```

Remove the full `vi.mock("lenis", ...)` block.

Remove from `afterEach`:

```ts
lenisConstructorOptions.length = 0;
```

- [x] **Step 2: Simplify the adapter assertion**

Change the test named `"passes the official smooth scroll adapter into the demo runtime"` to:

```tsx
test("passes the official smooth scroll adapter into the demo runtime", async () => {
  await renderApp();

  expect(runtimeProps[0]?.scrollAdapter).toMatchObject({
    kind: "lenis",
    readMetrics: expect.any(Function),
  });
});
```

- [x] **Step 3: Remove StrictMode-specific helper**

Delete:

```ts
async function renderStrictApp(): Promise<HTMLElement> {
  const { default: App } = await import("./App");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  await act(async () => {
    root.render(createElement(StrictMode, null, createElement(App)));
  });
  await flushSmoothScrollPublishFrame();

  return host;
}
```

Keep `flushSmoothScrollPublishFrame()` because `renderApp()` still needs to wait for the hook's state publication.

- [x] **Step 4: Run App tests**

Run:

```bash
npm test -- --run apps/demo/src/App.test.tsx
```

Expected: PASS.

---

### Task 4: Align Documentation With Simple Ownership

**Files:**
- Modify: `docs/agent/scroll-adapters.md`

- [x] **Step 1: Replace ownership wording**

In `docs/agent/scroll-adapters.md`, replace the current demo tuning paragraph with:

```md
When Lenis is manually driven by the GSAP ticker, configure Lenis with
`autoRaf: false` in the application-owned Lenis setup. The demo imports
`lenis/dist/lenis.css`, creates the Lenis instance inside
`useDemoSmoothScrollStack(...)`, passes it to `createLenisGsapScrollStack(...)`
with `manageLenis: false`, and destroys Lenis from the same hook cleanup. This
keeps ownership simple: the app owns Lenis, while the adapter stack owns only
runtime adapter subscriptions, GSAP ticker wiring, and optional ScrollTrigger
updates.
```

- [x] **Step 2: Run docs whitespace check**

Run:

```bash
git diff --check
```

Expected: no output, exit 0.

---

### Task 5: Browser Verification

**Files:**
- No source changes unless verification fails.

- [x] **Step 1: Start or reuse the demo dev server**

Run:

```bash
npm run dev --workspace @project/dom-webgl-demo -- --host 127.0.0.1 --port 5173
```

Expected: Vite reports a local URL, commonly `http://127.0.0.1:5173/` or the next free port.

- [x] **Step 2: Verify Lenis owns wheel input**

Open the Vite URL in a real browser or Playwright and run:

```js
document.documentElement.className
```

Expected: includes `lenis`.

Then run:

```js
window.scrollTo(0, 0);
window.__wheelEvents = [];
window.addEventListener(
  "wheel",
  (event) => window.__wheelEvents.push({
    deltaY: event.deltaY,
    defaultPrevented: event.defaultPrevented,
  }),
  { passive: false },
);
```

Wheel once over the page.

Run:

```js
({
  scrollY: window.scrollY,
  htmlClass: document.documentElement.className,
  wheelEvents: window.__wheelEvents,
})
```

Expected:

```js
{
  scrollY: /* less than the raw wheel delta immediately after the wheel */,
  htmlClass: "lenis lenis-scrolling lenis-smooth",
  wheelEvents: [{ deltaY: 900, defaultPrevented: true }]
}
```

The exact `scrollY` can vary by frame timing, but it must not instantly equal the raw wheel delta.

---

### Task 6: Final Verification

**Files:**
- No source changes unless verification fails.

- [x] **Step 1: Run focused tests**

Run:

```bash
npm test -- --run apps/demo/src/useDemoSmoothScrollStack.test.tsx apps/demo/src/App.test.tsx apps/demo/src/demoCss.test.ts packages/dom-webgl-scroll-adapters/src/gsap.test.ts packages/dom-webgl-scroll-adapters/src/smoothScrollStack.test.ts packages/dom-webgl-scroll-adapters/src/lenis.test.ts packages/dom-webgl-scroll-adapters/src/scrollTrigger.test.ts
```

Expected: all test files pass.

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: `tsc -p tsconfig.base.json --noEmit` exits 0.

- [x] **Step 3: Run demo build**

Run:

```bash
npm run build --workspace @project/dom-webgl-demo
```

Expected: Vite build exits 0. Existing large chunk warning is acceptable.

- [x] **Step 4: Run import boundary check**

Run:

```bash
npm run check:imports
```

Expected:

```txt
Demo import boundary OK
```

- [x] **Step 5: Check git diff**

Run:

```bash
git status --short
git diff -- apps/demo/src/App.tsx apps/demo/src/useDemoSmoothScrollStack.ts apps/demo/src/useDemoSmoothScrollStack.test.tsx apps/demo/src/App.test.tsx apps/demo/src/demoCss.test.ts docs/agent/scroll-adapters.md
```

Expected: only the planned files changed.

---

## Self-Review

- Spec coverage: The plan lowers complexity by removing module-level active Lenis repair and generation guard from `App.tsx`; it modularizes smooth-scroll lifecycle into `useDemoSmoothScrollStack.ts`; it keeps the adapter package low-coupled and unchanged; it preserves focused tests and browser evidence.
- Placeholder scan: No task uses TBD/TODO/fill-in instructions. Each code-changing step includes concrete code.
- Type consistency: `useDemoSmoothScrollStack()` consistently returns `LenisGsapScrollStack | null`; Lenis ownership is app-owned with `manageLenis: false`; App-level tests no longer assert hook internals.
