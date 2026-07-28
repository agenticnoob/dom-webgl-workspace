# Third-Party Scroll Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a low-coupling scroll adapter layer so applications can connect Lenis, GSAP, and ScrollTrigger without making the core runtime depend on those libraries.

**Implementation status:** Completed on `2026-06-22`. Core exposes `WebGLScrollAdapter`, native scroll now runs through the same adapter boundary, React forwards stable `scrollAdapter` references, `@project/dom-webgl-scroll-adapters` provides optional Lenis/GSAP/ScrollTrigger glue, docs are aligned, and full workspace verification passed.

**Architecture:** Keep native page scroll and scene-gated scroll as the default core behavior. Expose a small public scroll adapter protocol from `@project/dom-webgl-runtime`; implement third-party bindings in an optional adapter package that depends only on public runtime types. Core owns frame input, page/gate state, scroll lock, target lifecycle, and effect context; adapters only provide page metrics, delta routing, subscription hooks, and optional third-party refresh/update callbacks.

**Tech Stack:** TypeScript, existing runtime input pipeline, React adapter props, Vitest, optional peer integrations for Lenis and GSAP/ScrollTrigger, docs in `README.md`, `docs/00-goal.md`, `docs/agent/package-usage.md`, and `docs/EXECUTION_STATE.md`.

---

## Current Truth

- The project is a reusable open-source DOM WebGL runtime. `apps/demo` is only a public API consumer and validation surface.
- Current runtime scroll behavior supports native page mode and scene-gated mode.
- `createScrollController(...)` owns page state, gate state, wheel/touch delta routing, and scroll-lock release.
- `createFrameInputSource(...)` consumes a generic `ScrollStateController`; effects read the resulting state through `ctx.scroll` and `ctx.scrollProgress`.
- `createWebGLRuntime(...)` uses native browser scroll by default and accepts an optional `WebGLScrollAdapter` for application-owned third-party scroll systems.
- `RuntimeInternalOptions.scrollState` already exists as an internal test seam. It is not public API and should not be exposed directly.
- React `<WebGLRuntime />` forwards `scrollAdapter` and recreates the runtime only when the adapter reference changes.
- Project docs now treat third-party scroll support as an adapter boundary: core owns the protocol and native scroll, while optional Lenis/GSAP/ScrollTrigger glue lives in `@project/dom-webgl-scroll-adapters`.

## Third-Party API Facts To Re-Verify During Implementation

These facts were checked against current Context7 docs on 2026-06-22 and must be rechecked before coding adapter internals:

- Lenis documents manual frame driving through `lenis.raf(timeInMs)`.
- Lenis documents ScrollTrigger sync with `lenis.on("scroll", ScrollTrigger.update)`.
- Lenis documents GSAP ticker integration with `gsap.ticker.add((time) => lenis.raf(time * 1000))`.
- Lenis documents `destroy()` for cleanup and exposes scroll/progress/velocity-style instance state.
- GSAP ScrollTrigger documents `ScrollTrigger.update()`, `ScrollTrigger.refresh()`, and `ScrollTrigger.scrollerProxy(scroller, vars)`.
- ScrollTrigger `scrollerProxy(...)` is the correct bridge when a third-party scroller owns `scrollTop` / `scrollLeft`.

Do not encode these third-party APIs into `packages/dom-webgl-runtime/src/lib/*`. Put them behind optional adapters.

## Recommended Approach

### Option A: Public Protocol Only

Core exposes `WebGLScrollAdapter`, and downstream applications write their own Lenis/GSAP glue.

Trade-off: lowest coupling and smallest package, but consumers repeat adapter code and agent docs must explain more.

### Option B: Public Protocol Plus Optional Adapter Package

Core exposes `WebGLScrollAdapter`. A separate workspace package, `@project/dom-webgl-scroll-adapters`, provides `createLenisScrollAdapter(...)`, `createGsapTickerLenisBridge(...)`, and `createScrollTriggerBridge(...)`.

Trade-off: slightly more package surface, but core remains clean and consumers get a tested integration path.

Recommendation: Option B. It preserves package boundaries, avoids hard dependencies in core, and gives Lenis/GSAP users a canonical path.

### Option C: Direct Runtime Ownership Of Lenis/GSAP

`@project/dom-webgl-runtime` imports Lenis, GSAP, or ScrollTrigger directly and owns their lifecycle.

Trade-off: easier initial demo wiring, but it couples the reusable runtime to optional animation libraries, increases bundle surface, and conflicts with the current open-source package boundary.

Decision: reject Option C.

## Public Contract

Add public types to the runtime root entrypoint:

```ts
export type WebGLScrollMetrics = {
  scrollY: number;
  scrollHeight: number;
  viewportHeight: number;
};

export type WebGLScrollDeltaRouter = (deltaY: number) => boolean;

export type WebGLScrollGateState =
  | { active: false }
  | { active: true; key: string; progress: number };

export type WebGLScrollAdapter = {
  readonly kind?: string;
  readMetrics(): WebGLScrollMetrics;
  connectDeltaRouter?(router: WebGLScrollDeltaRouter): () => void;
  subscribe?(listener: () => void): () => void;
  onGateStateChange?(state: WebGLScrollGateState): void;
  dispose?(): void;
};
```

Extend runtime options:

```ts
export type WebGLRuntimeOptions = {
  container: HTMLElement;
  effects?: readonly WebGLEffectDefinition[];
  scrollAdapter?: WebGLScrollAdapter;
  onDebugStateChange?: (state: WebGLDebugState) => void;
};
```

Extend React props:

```ts
export type WebGLRuntimeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  effects?: WebGLRuntimeOptions["effects"];
  scrollAdapter?: WebGLRuntimeOptions["scrollAdapter"];
  onDebugStateChange?: (state: WebGLDebugState) => void;
};
```

Rules:

- `scrollAdapter` reference must be stable, just like runtime-level `effects`.
- Native scroll remains the default when `scrollAdapter` is omitted.
- Effects do not receive adapter objects. They continue to consume `ctx.scroll`, `ctx.scrollProgress`, `ctx.input`, and `ctx.delta`.
- Core never imports `lenis`, `gsap`, or `ScrollTrigger`.
- Adapter implementations never import `packages/dom-webgl-runtime/src/lib/*`; they import only public runtime types.

## Internal Module Shape

Modify the runtime package:

- Create `packages/dom-webgl-runtime/src/lib/input/scrollAdapter.ts`
  - Own public adapter type aliases or internal re-exports from `types.ts`.
  - Provide `createNativeScrollAdapter(input)` for default metrics and native delta routing.
- Create `packages/dom-webgl-runtime/src/lib/input/scrollDeltaRouter.ts`
  - Move wheel/touch event routing out of `scrollController.ts`.
  - Keep the browser delta normalization already covered by `scrollDelta.test.ts`.
- Modify `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`
  - Rename or re-export `PageScrollMetrics` as `WebGLScrollMetrics`.
  - Keep page progress math independent of Lenis/GSAP.
- Modify `packages/dom-webgl-runtime/src/lib/input/scrollController.ts`
  - Accept `scrollAdapter?: WebGLScrollAdapter`.
  - Use `adapter.readMetrics()` instead of a hardcoded metrics callback when provided.
  - Use `adapter.connectDeltaRouter(...)` when provided; otherwise use native wheel/touch routing.
  - Call `adapter.onGateStateChange(...)` on gate enter, progress update, release, unregister, dispose, and fatal release paths.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Pass `options.scrollAdapter` into `createScrollController(...)`.
  - Keep `releaseActiveGate(...)` on layout/render errors and visibility loss.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
  - Forward `scrollAdapter`.
  - Include `scrollAdapter` in runtime creation dependencies.
  - Document stable reference requirements.
- Modify `packages/dom-webgl-runtime/src/index.ts`
  - Export `WebGLScrollAdapter`, `WebGLScrollMetrics`, `WebGLScrollDeltaRouter`, and `WebGLScrollGateState`.

Add optional adapter package:

- Create `packages/dom-webgl-scroll-adapters/package.json`
  - Name: `@project/dom-webgl-scroll-adapters`.
  - Peer dependencies: Lenis and GSAP are optional peer integrations.
  - Runtime dependency: `@project/dom-webgl-runtime` through workspace linkage.
- Create `packages/dom-webgl-scroll-adapters/src/lenis.ts`
  - Export `createLenisScrollAdapter(lenis, options?)`.
  - Read metrics from the Lenis instance where available and fall back to DOM scroll metrics only when explicitly configured.
  - Subscribe to Lenis scroll events and call runtime listeners.
  - Dispose only listeners owned by the adapter; do not destroy a consumer-owned Lenis instance unless the caller opts into managed ownership.
- Create `packages/dom-webgl-scroll-adapters/src/gsap.ts`
  - Export `createGsapTickerLenisBridge({ gsap, lenis, scrollTrigger? })`.
  - Own ticker add/remove cleanup.
  - Call `ScrollTrigger.update` from Lenis scroll events when provided.
  - Do not create timelines or product animations.
- Create `packages/dom-webgl-scroll-adapters/src/scrollTrigger.ts`
  - Export `createScrollTriggerBridge({ ScrollTrigger, scroller?, proxy? })`.
  - Provide helper wiring for `ScrollTrigger.update`, `ScrollTrigger.refresh`, and optional `scrollerProxy`.
  - Keep trigger/timeline authoring in the application.

## Data Flow

Native default:

```txt
wheel/touch/window scroll
  -> native scroll adapter
  -> scroll controller
  -> frame input
  -> renderable update + effect context
```

Lenis:

```txt
Lenis instance
  -> Lenis adapter readMetrics/subscribe
  -> scroll controller
  -> frame input
  -> renderable update + effect context
```

Lenis plus GSAP/ScrollTrigger:

```txt
GSAP ticker
  -> Lenis raf
  -> Lenis scroll event
  -> ScrollTrigger.update
  -> runtime scroll adapter listener
  -> runtime frame input
```

Scene gate:

```txt
wheel/touch delta
  -> adapter connectDeltaRouter
  -> scroll controller gate state
  -> adapter onGateStateChange
  -> runtime frame input sceneProgress
  -> release back to page mode
```

## Task Plan

### Task 1: Lock Public Scroll Adapter Types

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] Add the public `WebGLScrollMetrics`, `WebGLScrollDeltaRouter`, `WebGLScrollGateState`, and `WebGLScrollAdapter` types.
- [x] Export the types from the root entrypoint.
- [x] Extend the public export type fixture to import these types from `@project/dom-webgl-runtime`.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: public export test passes and no internal runtime types are required by adapter consumers.

### Task 2: Extract Native Scroll Adapter Without Behavior Change

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollAdapter.ts`
- Create: `packages/dom-webgl-runtime/src/lib/input/scrollDeltaRouter.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/input/scrollController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/input/pageScroll.ts`

- [x] Move the native wheel/touch event routing currently inside `scrollController.ts` into `scrollDeltaRouter.ts`.
- [x] Add `createNativeScrollAdapter(...)` that reads native page metrics and connects native delta routing.
- [x] Keep `createScrollController(...)` behavior identical when no third-party adapter is provided.
- [x] Add regression tests for page mode, gate enter, gate progress, gate release, touch routing, wheel prevention, and dispose cleanup.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/input/pageScroll.test.ts packages/dom-webgl-runtime/src/lib/input/scrollController.test.ts packages/dom-webgl-runtime/src/lib/input/scrollDelta.test.ts
```

Expected: existing native scroll and gate behavior remains unchanged.

### Task 3: Add Runtime And React Adapter Entry Points

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`

- [x] Add `scrollAdapter?: WebGLScrollAdapter` to `WebGLRuntimeOptions`.
- [x] Wire `options.scrollAdapter` into the scroll controller.
- [x] Verify an injected adapter controls `pageProgress`, direction, and velocity in frame input.
- [x] Verify gate release paths call adapter gate-state callbacks.
- [x] Add React tests that `<WebGLRuntime scrollAdapter={adapter} />` forwards the adapter and recreates the runtime only when the adapter reference changes.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx
```

Expected: runtime and React adapter support injected scroll adapters while preserving SSR-safe import behavior.

### Task 4: Add Optional Third-Party Adapter Package

**Files:**
- Create: `packages/dom-webgl-scroll-adapters/package.json`
- Create: `packages/dom-webgl-scroll-adapters/tsconfig.json`
- Create: `packages/dom-webgl-scroll-adapters/src/index.ts`
- Create: `packages/dom-webgl-scroll-adapters/src/lenis.ts`
- Create: `packages/dom-webgl-scroll-adapters/src/gsap.ts`
- Create: `packages/dom-webgl-scroll-adapters/src/scrollTrigger.ts`
- Create: `packages/dom-webgl-scroll-adapters/src/*.test.ts`

- [x] Add a workspace package that imports only public runtime types.
- [x] Implement adapters against structural third-party interfaces so unit tests can use fake Lenis/GSAP/ScrollTrigger objects.
- [x] Keep Lenis instance ownership explicit: default is consumer-owned; managed destroy is opt-in.
- [x] Keep GSAP ticker ownership explicit: the bridge removes only callbacks it added.
- [x] Keep ScrollTrigger ownership explicit: the bridge calls update/refresh/proxy helpers but does not create triggers or timelines.
- [x] Run:

```bash
npm test -- --run packages/dom-webgl-scroll-adapters/src
npm run typecheck
```

Expected: adapter package type-checks without pulling Lenis or GSAP into runtime core.

### Task 5: Add Public Usage Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/agent/package-usage.md`
- Create: `docs/agent/scroll-adapters.md`

- [x] Document that native page scroll remains the default.
- [x] Document when to use `scrollAdapter`.
- [x] Document stable reference rules for React.
- [x] Document Lenis ownership, GSAP ticker cleanup, and ScrollTrigger proxy boundaries.
- [x] Document that effects still consume `ctx.scroll`, not third-party instances.
- [x] Document that core has no Lenis/GSAP/ScrollTrigger dependency.
- [x] Run:

```bash
rg -n "Lenis|GSAP|ScrollTrigger|scrollAdapter|third-party scroll" README.md docs
git diff --check
```

Expected: docs describe the new adapter boundary without implying core owns third-party libraries.

### Task 6: Add Demo Or Example Validation Without Runtime Hardcoding

**Files:**
- Prefer create: `apps/demo/src/thirdPartyScrollExample.tsx`
- Or create docs-only example: `docs/examples/third-party-scroll-adapters.md`
- Modify: `apps/demo/src/demo-import-boundary.test.ts`
- Modify: `scripts/assert-demo-public-imports.mjs` only if the new adapter package needs explicit allow-listing.

- [x] Add a small opt-in example that imports runtime and adapter packages through public entrypoints.
- [x] Do not make Lenis/GSAP required for the default demo page.
- [x] Do not add demo keys, asset paths, DOM structure, layout, or copy into runtime/package implementation.
- [x] Run:

```bash
npm run check:imports
npm test -- --run apps/demo/src/demo-import-boundary.test.ts
```

Expected: demo remains a public API consumer and does not import runtime internals.

### Task 7: Full Verification

**Files:**
- All changed package, demo, docs, and config files.

- [x] Run targeted tests from Tasks 1-6.
- [x] Run:

```bash
npm run typecheck
npm test -- --run
npm run check:imports
npm run build
git diff --check
```

Expected: full workspace verification passes. Existing non-blocking Vite chunk-size warnings remain acceptable if unchanged.

## Non-Goals

- Do not make Lenis, GSAP, or ScrollTrigger dependencies of `@project/dom-webgl-runtime`.
- Do not create GSAP timelines, ScrollTrigger triggers, or product animations in core.
- Do not let effects read third-party scroll instances directly.
- Do not replace the existing native page/gate scroll contract.
- Do not introduce a second runtime-owned animation loop in React.
- Do not expose raw renderer, camera, scene, or canvas mutation as part of scroll integration.
- Do not hardcode demo target keys, assets, DOM shape, layout, or copy.

## Acceptance Criteria

- Native scroll behavior is unchanged when no adapter is supplied.
- Runtime frame input reports page/gate scroll state from the adapter protocol.
- Scene-gated scroll can consume wheel/touch delta through the adapter boundary and always releases locks.
- Lenis/GSAP/ScrollTrigger integrations live outside core and are optional.
- React users can pass a stable `scrollAdapter` reference.
- Public docs explain ownership, cleanup, and failure modes.
- Tests cover public exports, native parity, injected adapters, gate release, React forwarding, adapter cleanup, and demo import boundaries.
