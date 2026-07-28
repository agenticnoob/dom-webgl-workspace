# Offscreen WebGL DOM Resource Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduce offscreen runtime cost by pausing near-offscreen WebGL work, disposing far-offscreen WebGL resources, and restoring native DOM fallback as the default low-cost far-offscreen representation.

**Implementation status:** Completed on `2026-06-21` in branch
`codex/offscreen-renderable-cache`. The runtime exposes lifecycle offscreen
policy, parks near-offscreen renderables without running effects, evicts parked
renderables after warm TTL, restores DOM fallback before far-offscreen disposal,
and documents the target-scoped resource policy in active package docs.

**Architecture:** Keep the project model target-scoped: a registered DOM target creates one renderable, and child DOM is not implicitly loaded into WebGL. Near-offscreen targets may be parked without running effects; far-offscreen targets restore their native fallback and dispose WebGL resources. DOM fallback ownership stays explicit through `hideMode: "self"` or `hideMode: "subtree"`; the default must not freeze or hide unregistered child DOM.

**Tech Stack:** TypeScript, Vitest, JSDOM, existing DOM WebGL runtime modules in `packages/dom-webgl-runtime/src/lib`, existing docs in `README.md` and `docs/agent/package-usage.md`.

---

## Starting Truth Before This Plan

- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts` currently classifies targets with `createViewportLifecycle()` using hardcoded margins: active `50vh`, preload `150vh`, mount `100vh`, unload `250vh`.
- Only `active` targets create or update renderables. Non-active targets set debug state and continue.
- The `disposed` branch currently restores fallback visibility, disposes the effect controller, disposes the renderable, and deletes runtime maps.
- `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts` hides fallback with `visibility: hidden`; `hideMode: "self"` keeps child DOM visible, and `hideMode: "subtree"` hides descendants.
- At the start of this plan, active docs still described offscreen caching as
  missing and said disposed targets rebuilt from DOM/source on re-entry.

## Completed Truth

- `WebGLLifecycleDeclaration` now accepts
  `offscreen: { strategy?: "restore-dom" | "park"; warmTtlMs?: number }`.
- `compileOffscreenPolicy(...)` normalizes the lifecycle declaration into
  runtime defaults and clamps warm TTL to `30_000ms`.
- Near-offscreen targets using `strategy: "park"` keep their renderable briefly,
  hide the WebGL scene object, and skip effect updates.
- Parked targets resume without recreating their renderable when they re-enter
  active range before TTL expiry.
- Parked targets restore DOM fallback and dispose WebGL resources after TTL
  expiry, and far-offscreen disposal restores fallback by default.
- `hideMode: "self"` ownership is covered so unregistered child DOM remains
  native through park/dispose flows.
- Active docs now describe offscreen policy as target-scoped resource behavior,
  not as missing offscreen caching.

## Resource Direction

Default behavior should optimize for this project assumption:

- Native DOM has no WebGL effects.
- Native DOM is the low-cost far-offscreen fallback.
- WebGL is the active or near-active visual layer.
- Restoring DOM when far offscreen is acceptable and usually cheaper than retaining GLB, video textures, particles, render targets, and effect-owned GPU objects.

The runtime should therefore use this lifecycle:

```text
declared
-> active: create WebGL renderable and hide fallback after readiness
-> parked: near offscreen, keep resources briefly, hide WebGL object, pause effects
-> disposed: far offscreen, restore DOM fallback and release WebGL resources
-> active again: rebuild WebGL from DOM/source, then hide fallback after readiness
```

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Add public lifecycle options for offscreen strategy and warm park TTL.
  - Keep defaults compatible with current behavior.
- Create `packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.ts`
  - Normalize lifecycle offscreen options into runtime-owned defaults.
  - Clamp warm TTL values.
  - Keep policy code out of the large runtime file.
- Create `packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.test.ts`
  - Cover default restore/dispose policy.
  - Cover clamped warm TTL.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Track parked target timestamps.
  - Park near-offscreen renderables by hiding WebGL scene objects and skipping effect updates.
  - Resume parked renderables when active again.
  - Dispose far-offscreen renderables and restore DOM fallback by default.
  - Keep unregister/runtime dispose restoring fallback regardless of policy.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
  - Add regression tests for park, resume, far dispose, and fallback restore.
- Modify `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`
  - Add regression coverage that `hideMode: "self"` does not mutate child DOM when park/dispose flows call hide/restore.
- Modify `packages/dom-webgl-runtime/src/lib/types.test.ts`
  - Add type coverage for lifecycle offscreen options.
- Modify `README.md`
  - Replace “offscreen caching is not implemented” language with the new target lifecycle truth.
- Modify `docs/agent/package-usage.md`
  - Document the public lifecycle policy, child DOM ownership, and default far-offscreen restore behavior.
- Modify `docs/EXECUTION_STATE.md` if it mentions offscreen caching, viewport lifecycle, fallback restore, or performance status.

## Public API

Add a narrow lifecycle extension:

```ts
export type WebGLOffscreenStrategy = "restore-dom" | "park";

export type WebGLOffscreenLifecycleDeclaration = {
  strategy?: WebGLOffscreenStrategy;
  warmTtlMs?: number;
};

export type WebGLLifecycleDeclaration = {
  hideWhenReady?: boolean;
  hideMode?: "subtree" | "self";
  offscreen?: WebGLOffscreenLifecycleDeclaration;
};
```

Default policy:

```ts
{
  strategy: "restore-dom",
  warmTtlMs: 0,
}
```

Semantics:

- `"restore-dom"` means far-offscreen disposal restores DOM fallback before releasing WebGL resources.
- `"park"` means near-offscreen renderables can be kept briefly invisible without effect updates; far-offscreen still disposes once TTL expires or unload distance is reached.
- `warmTtlMs` controls how long a parked target may retain WebGL resources after leaving active state. `0` means no time-based retention beyond the current lifecycle pass.

## Task 1: Add Offscreen Policy Types

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`

- [x] **Step 1: Write failing public type coverage**

Add this inside the fixture string in `packages/dom-webgl-runtime/src/lib/types.test.ts`, after the existing `subtreeLifecycle` declaration:

```ts
        const restoreDomLifecycle = {
          hideWhenReady: true,
          hideMode: "self",
          offscreen: {
            strategy: "restore-dom",
            warmTtlMs: 0,
          },
        } satisfies WebGLLifecycleDeclaration;
        const parkLifecycle = {
          hideWhenReady: true,
          hideMode: "self",
          offscreen: {
            strategy: "park",
            warmTtlMs: 1500,
          },
        } satisfies WebGLLifecycleDeclaration;
```

Add these assertions after `subtreeLifecycle satisfies WebGLLifecycleDeclaration;`:

```ts
        restoreDomLifecycle satisfies WebGLLifecycleDeclaration;
        parkLifecycle satisfies WebGLLifecycleDeclaration;
```

Add this negative fixture near the existing lifecycle `@ts-expect-error` block:

```ts
        ({
          hideWhenReady: true,
          offscreen: {
            // @ts-expect-error offscreen strategy only supports restore-dom or park.
            strategy: "keep-active",
          },
        } satisfies WebGLLifecycleDeclaration);
```

- [x] **Step 2: Run the failing type test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts
```

Expected: FAIL because `offscreen` does not exist on `WebGLLifecycleDeclaration`.

- [x] **Step 3: Add public lifecycle types**

Modify `packages/dom-webgl-runtime/src/lib/types.ts` around the current lifecycle declaration:

```ts
export type WebGLOffscreenStrategy = "restore-dom" | "park";

export type WebGLOffscreenLifecycleDeclaration = {
  strategy?: WebGLOffscreenStrategy;
  warmTtlMs?: number;
};

export type WebGLLifecycleDeclaration = {
  hideWhenReady?: boolean;
  hideMode?: "subtree" | "self";
  offscreen?: WebGLOffscreenLifecycleDeclaration;
};
```

- [x] **Step 4: Run the type test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/types.test.ts
git commit -m "feat: add offscreen lifecycle policy types"
```

## Task 2: Add Runtime Offscreen Policy Compiler

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.ts`
- Create: `packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.test.ts`

- [x] **Step 1: Write failing policy tests**

Create `packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { compileOffscreenPolicy } from "./offscreenPolicy";

describe("compileOffscreenPolicy", () => {
  test("defaults to restore-dom with no warm retention", () => {
    expect(compileOffscreenPolicy(undefined)).toEqual({
      strategy: "restore-dom",
      warmTtlMs: 0,
    });
  });

  test("keeps explicit park strategy and clamps warm TTL", () => {
    expect(
      compileOffscreenPolicy({
        offscreen: {
          strategy: "park",
          warmTtlMs: 2500,
        },
      }),
    ).toEqual({
      strategy: "park",
      warmTtlMs: 2500,
    });
  });

  test("normalizes invalid warm TTL values to zero", () => {
    expect(
      compileOffscreenPolicy({
        offscreen: {
          strategy: "park",
          warmTtlMs: -1,
        },
      }),
    ).toEqual({
      strategy: "park",
      warmTtlMs: 0,
    });
  });
});
```

- [x] **Step 2: Run the failing policy tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.test.ts
```

Expected: FAIL because `./offscreenPolicy` does not exist.

- [x] **Step 3: Implement policy compiler**

Create `packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.ts`:

```ts
import type {
  WebGLLifecycleDeclaration,
  WebGLOffscreenStrategy,
} from "../types";

export type RuntimeOffscreenPolicy = {
  strategy: WebGLOffscreenStrategy;
  warmTtlMs: number;
};

export function compileOffscreenPolicy(
  lifecycle: WebGLLifecycleDeclaration | undefined,
): RuntimeOffscreenPolicy {
  const offscreen = lifecycle?.offscreen;

  return {
    strategy: offscreen?.strategy ?? "restore-dom",
    warmTtlMs: normalizeWarmTtl(offscreen?.warmTtlMs),
  };
}

function normalizeWarmTtl(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return 0;
  }

  return Math.min(value, 30_000);
}
```

- [x] **Step 4: Run policy tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.ts packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.test.ts
git commit -m "feat: compile offscreen lifecycle policy"
```

## Task 3: Park Near-Offscreen Renderables

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing park test**

Add this test in `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts` after `restores hidden fallback when viewport lifecycle disposes a ready renderable`:

```ts
  test("parks near-offscreen renderables without restoring DOM fallback", async () => {
    const element = document.createElement("section");
    const setVisible = vi.fn();
    const update = vi.fn();
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    const runtime = await createPipelineRuntime({
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        const originalUpdate = renderable.update.bind(renderable);

        renderable.update = (input) => {
          update();
          return originalUpdate(input);
        };
        renderable.setVisible = setVisible;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible: true,
          }),
        });
      },
    });

    runtime.registerTarget(element, {
      key: "hero.park",
      lifecycle: {
        hideWhenReady: true,
        hideMode: "subtree",
        offscreen: { strategy: "park", warmTtlMs: 2000 },
      },
    });

    await runtime.sync();
    expect(element.style.visibility).toBe("hidden");
    expect(update).toHaveBeenCalledTimes(1);

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    await runtime.sync();

    expect(setVisible).toHaveBeenLastCalledWith(false);
    expect(update).toHaveBeenCalledTimes(1);
    expect(element.style.visibility).toBe("hidden");
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.park",
      lifecycleState: "paused",
      visible: false,
    });

    runtime.dispose();
  });
```

- [x] **Step 2: Run failing park test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "parks near-offscreen renderables"
```

Expected: FAIL because non-active renderables are not explicitly parked and debug state is not `paused`.

- [x] **Step 3: Wire offscreen policy into runtime**

Modify imports in `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`:

```ts
import { compileOffscreenPolicy } from "./offscreenPolicy";
```

Add a map near the other runtime maps:

```ts
  const parkedAtByTargetKey = new Map<string, number>();
```

Clear it in `unregisterTarget` after fallback controller deletion:

```ts
      parkedAtByTargetKey.delete(targetKey);
```

Clear it in runtime `dispose()` with the other maps:

```ts
        parkedAtByTargetKey.clear();
```

Clear it inside `disposeTargetRenderable(...)` by extending the helper signature:

```ts
      disposeTargetRenderable(
        targetKey,
        renderablesByTargetKey,
        effectControllersByTargetKey,
        renderables,
        debugRecordsByTargetKey,
        parkedAtByTargetKey,
      );
```

Update the helper signature and body:

```ts
function disposeTargetRenderable(
  key: string,
  renderablesByTargetKey: Map<string, Renderable>,
  effectControllersByTargetKey: Map<string, WebGLEffectController>,
  renderables: Set<DisposableRenderable>,
  debugRecordsByTargetKey: Map<string, TargetDebugRecord>,
  parkedAtByTargetKey: Map<string, number>,
): void {
  const renderable = renderablesByTargetKey.get(key);
  const effectController = effectControllersByTargetKey.get(key);

  parkedAtByTargetKey.delete(key);
  effectControllersByTargetKey.delete(key);
  effectController?.dispose();

  if (!renderable) {
    debugRecordsByTargetKey.delete(key);
    return;
  }

  renderablesByTargetKey.delete(key);
  renderables.delete(renderable);
  debugRecordsByTargetKey.delete(key);
  renderable.dispose();
}
```

- [x] **Step 4: Implement park branch**

Replace the current non-active branch:

```ts
      if (viewportState !== "active") {
        debugRecord.lifecycleState =
          viewportState === "preloading" ? "preloading" : "inactive";
        continue;
      }
```

with:

```ts
      if (viewportState !== "active") {
        const policy = compileOffscreenPolicy(descriptor.declaration.lifecycle);

        if (renderable && policy.strategy === "park") {
          if (!parkedAtByTargetKey.has(descriptor.key)) {
            parkedAtByTargetKey.set(descriptor.key, frameInput.time);
          }

          renderable.setVisible(false);
          debugRecord.lifecycleState = "paused";
          debugRecord.visible = false;
          continue;
        }

        debugRecord.lifecycleState =
          viewportState === "preloading" ? "preloading" : "inactive";
        continue;
      }
```

Add this immediately after the active branch starts and before `if (!renderable)`:

```ts
      parkedAtByTargetKey.delete(descriptor.key);
      renderable?.setVisible(true);
```

- [x] **Step 5: Run park test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "parks near-offscreen renderables"
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "feat: park near-offscreen renderables"
```

## Task 4: Dispose Parked Renderables After Warm TTL

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing TTL disposal test**

Add this test after the park test:

```ts
  test("restores DOM fallback and disposes parked renderables after warm TTL", async () => {
    const element = document.createElement("section");
    const dispose = vi.fn();
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    let now = 0;
    const runtime = await createPipelineRuntime({
      clock: () => now,
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        const originalDispose = renderable.dispose.bind(renderable);

        renderable.dispose = () => {
          dispose();
          originalDispose();
        };
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible: true,
          }),
        });
      },
    });

    runtime.registerTarget(element, {
      key: "hero.park.ttl",
      lifecycle: {
        hideWhenReady: true,
        hideMode: "subtree",
        offscreen: { strategy: "park", warmTtlMs: 100 },
      },
    });

    await runtime.sync();
    expect(element.style.visibility).toBe("hidden");

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    now = 50;
    await runtime.sync();
    expect(dispose).toHaveBeenCalledTimes(0);
    expect(element.style.visibility).toBe("hidden");

    now = 200;
    await runtime.sync();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(element.style.visibility).toBe("");
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.park.ttl",
      lifecycleState: "disposed",
      visible: false,
    });

    runtime.dispose();
  });
```

- [x] **Step 2: Run failing TTL test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "warm TTL"
```

Expected: FAIL because parked renderables are not evicted by elapsed time.

- [x] **Step 3: Add TTL eviction helper**

Add this helper below `disposeTargetRenderable(...)`:

```ts
function shouldDisposeParkedRenderable(input: {
  policy: ReturnType<typeof compileOffscreenPolicy>;
  parkedAt: number | undefined;
  now: number;
  viewportState: "active" | "mounted" | "preloading" | "disposed";
}): boolean {
  if (input.viewportState === "disposed") {
    return true;
  }

  if (input.policy.strategy !== "park") {
    return false;
  }

  if (input.policy.warmTtlMs <= 0) {
    return false;
  }

  if (input.parkedAt === undefined) {
    return false;
  }

  return input.now - input.parkedAt >= input.policy.warmTtlMs;
}
```

- [x] **Step 4: Use TTL eviction in the non-active branch**

At the top of the non-active branch, after `const policy = ...`, add:

```ts
        if (
          renderable &&
          shouldDisposeParkedRenderable({
            policy,
            parkedAt: parkedAtByTargetKey.get(descriptor.key),
            now: frameInput.time,
            viewportState,
          })
        ) {
          restoreFallbackVisibility(fallbackControllersByTargetKey, descriptor.key);
          effectControllersByTargetKey.get(descriptor.key)?.dispose();
          effectControllersByTargetKey.delete(descriptor.key);
          renderable.dispose();
          renderables.delete(renderable);
          renderablesByTargetKey.delete(descriptor.key);
          parkedAtByTargetKey.delete(descriptor.key);
          debugRecord.lifecycleState = "disposed";
          debugRecord.visible = false;
          continue;
        }
```

- [x] **Step 5: Run TTL test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "warm TTL"
```

Expected: PASS.

- [x] **Step 6: Run nearby runtime pipeline tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "feat: evict parked renderables after warm ttl"
```

## Task 5: Preserve Default Far-Offscreen Restore Behavior

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`

- [x] **Step 1: Write explicit default behavior regression test**

Modify the existing test named `restores hidden fallback when viewport lifecycle disposes a ready renderable` so the registered lifecycle includes no `offscreen` field:

```ts
    runtime.registerTarget(element, {
      key: "hero.lifecycle",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });
```

Keep the existing expectations:

```ts
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(element.style.visibility).toBe("");
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.lifecycle",
      lifecycleState: "disposed",
      visible: false,
    });
```

- [x] **Step 2: Run the default disposal regression**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "restores hidden fallback"
```

Expected: PASS before implementation changes and PASS after implementation changes. If it fails after Task 4, fix the disposed branch so default behavior restores fallback before disposing.

- [x] **Step 3: Refactor duplicated disposal code**

Add this helper below `disposeTargetRenderable(...)`:

```ts
function disposeRuntimeRenderable(input: {
  descriptor: TargetDescriptor;
  renderable: Renderable;
  renderablesByTargetKey: Map<string, Renderable>;
  effectControllersByTargetKey: Map<string, WebGLEffectController>;
  fallbackControllersByTargetKey: Map<string, FallbackVisibilityController>;
  renderables: Set<DisposableRenderable>;
  parkedAtByTargetKey: Map<string, number>;
  restoreFallback: boolean;
}): void {
  if (input.restoreFallback) {
    restoreFallbackVisibility(
      input.fallbackControllersByTargetKey,
      input.descriptor.key,
    );
  }

  input.effectControllersByTargetKey.get(input.descriptor.key)?.dispose();
  input.effectControllersByTargetKey.delete(input.descriptor.key);
  input.renderable.dispose();
  input.renderables.delete(input.renderable);
  input.renderablesByTargetKey.delete(input.descriptor.key);
  input.parkedAtByTargetKey.delete(input.descriptor.key);
}
```

Use the helper in the `viewportState === "disposed"` branch:

```ts
      if (viewportState === "disposed") {
        if (renderable) {
          disposeRuntimeRenderable({
            descriptor,
            renderable,
            renderablesByTargetKey,
            effectControllersByTargetKey,
            fallbackControllersByTargetKey,
            renderables,
            parkedAtByTargetKey,
            restoreFallback: true,
          });
        }
        debugRecord.lifecycleState = "disposed";
        debugRecord.visible = false;
        continue;
      }
```

Use the helper in TTL eviction with `restoreFallback: true`.

- [x] **Step 4: Run runtime pipeline tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "refactor: centralize offscreen renderable disposal"
```

## Task 6: Guard Child DOM Ownership

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Add fallback ownership regression test**

Add this test to `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`:

```ts
  test("self mode restores only the target fallback and preserves child inline visibility", () => {
    const element = document.createElement("section");
    const child = document.createElement("button");
    child.style.visibility = "visible";
    child.textContent = "Native child";
    element.appendChild(child);

    const controller = createFallbackVisibilityController(element, {
      hideWhenReady: true,
      hideMode: "self",
    });

    controller.hide();
    expect(element.style.visibility).toBe("hidden");
    expect(child.style.visibility).toBe("visible");

    controller.restore();
    expect(element.getAttribute("style")).toBeNull();
    expect(child.style.visibility).toBe("visible");
    expect(child.textContent).toBe("Native child");
  });
```

- [x] **Step 2: Run fallback tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts
```

Expected: PASS. If this fails, fix `fallbackVisibility.ts` without changing `hideMode: "self"` semantics.

- [x] **Step 3: Add runtime child DOM preservation test**

Add this test to `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts` after the default disposal regression:

```ts
  test("offscreen disposal with self mode does not hide unregistered child DOM", async () => {
    const element = document.createElement("section");
    const child = document.createElement("button");
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    element.appendChild(child);
    const runtime = await createPipelineRuntime({
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible: true,
          }),
        });
      },
    });

    runtime.registerTarget(element, {
      key: "mixed.card",
      lifecycle: { hideWhenReady: true, hideMode: "self" },
    });

    await runtime.sync();
    expect(element.style.visibility).toBe("hidden");
    expect(child.style.visibility).toBe("visible");

    measurement = createLayoutMeasurement(0, 3_600, 200, 120);
    await runtime.sync();

    expect(element.style.visibility).toBe("");
    expect(child.style.visibility).toBe("visible");

    runtime.dispose();
  });
```

- [x] **Step 4: Run ownership tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "self mode|unregistered child DOM"
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "test: guard fallback child dom ownership"
```

## Task 7: Document Offscreen Resource Policy

**Files:**
- Modify: `README.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Update README current visual behavior**

In `README.md`, replace the old pre-plan sentence that described offscreen
caching as missing:

```md
Concrete text animation effects, shader authoring APIs, core-provided
particle systems, animation layers, WebGL raycast picking, Lenis, GSAP, and
ScrollTrigger adapters remain intentionally out of scope. [Old wording said
offscreen caching was missing and disposed targets rebuilt on re-entry.]
```

with:

```md
Concrete text animation effects, shader authoring APIs, core-provided
particle systems, animation layers, WebGL raycast picking, Lenis, GSAP, and
ScrollTrigger adapters remain intentionally out of scope. Offscreen targets use
a target-scoped resource policy: active targets own WebGL resources, parked
near-offscreen targets pause effects and hide their WebGL scene object, and
far-offscreen targets restore native DOM fallback before disposing WebGL
resources. Re-entering after disposal rebuilds from the DOM/source, while
re-entering from park resumes the existing renderable.
```

- [x] **Step 2: Update package usage lifecycle section**

In `docs/agent/package-usage.md`, update the lifecycle rules section to include:

```md
- `lifecycle.offscreen.strategy: "restore-dom"` is the default. Far-offscreen
  targets restore their native DOM fallback before WebGL renderable disposal.
- `lifecycle.offscreen.strategy: "park"` allows near-offscreen targets to keep
  their WebGL resources briefly while pausing effect updates and hiding the
  WebGL scene object.
- `lifecycle.offscreen.warmTtlMs` controls how long a parked target may retain
  resources before fallback restore and disposal.
- `hideMode: "self"` remains the safe default for mixed DOM/WebGL targets:
  children are not implicitly loaded into WebGL and should stay native unless
  they register their own target.
- Use `hideMode: "subtree"` only when the entire subtree is intentionally
  WebGL-owned fallback.
```

- [x] **Step 3: Sweep execution state**

Run:

```bash
rg -n "offscreen|snapshot caching|restore fallback|viewport lifecycle|park" docs/EXECUTION_STATE.md
```

If matches mention the old missing-offscreen-caching wording or omit the new
policy, update only the matching section with this wording:

```md
Offscreen resource policy is target-scoped. Far-offscreen targets restore native
DOM fallback and dispose WebGL resources by default; near-offscreen parking is
available through lifecycle offscreen policy for short warm resumes.
```

If there are no matches, do not edit `docs/EXECUTION_STATE.md`.

- [x] **Step 4: Run active docs text sweep**

Run:

```bash
rg -n "Offscreen renderable or snapshot caching is not implemented yet|disposed targets currently restore|offscreen caching is not implemented" README.md docs/00-goal.md docs/EXECUTION_STATE.md docs/agent
```

Expected: no matches.

- [x] **Step 5: Commit**

```bash
git add README.md docs/agent/package-usage.md docs/EXECUTION_STATE.md
git commit -m "docs: describe offscreen webgl dom resource policy"
```

If `docs/EXECUTION_STATE.md` was not changed, omit it from `git add`.

## Task 8: Full Verification

**Files:**
- No source files should be edited in this task.

- [x] **Step 1: Run targeted tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/offscreenPolicy.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/types.test.ts
```

Expected: PASS.

- [x] **Step 2: Run package typecheck**

Run:

```bash
npm run typecheck --workspace @project/dom-webgl-runtime
```

Expected: PASS.

- [x] **Step 3: Run full check**

Run:

```bash
npm run check
```

Expected: PASS.

- [x] **Step 4: Run import boundary check**

Run:

```bash
npm run check:imports
```

Expected: PASS.

- [x] **Step 5: Run diff whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [x] **Step 6: Commit verification notes if docs changed during verification**

If verification requires docs corrections, commit them:

```bash
git add README.md docs/agent/package-usage.md docs/EXECUTION_STATE.md
git commit -m "docs: align offscreen policy verification notes"
```

If no docs corrections are needed, do not create a commit.

## Behavioral Acceptance Criteria

- A target that has never been active does not allocate WebGL resources.
- A target that leaves active range with `offscreen.strategy: "park"` stops effect updates and hides its WebGL scene object.
- A parked target that re-enters active before TTL expiry resumes without recreating its renderable.
- A parked target that exceeds TTL restores DOM fallback and disposes WebGL resources.
- A target that reaches disposed viewport state restores DOM fallback and disposes WebGL resources by default.
- `hideMode: "self"` never hides or freezes unregistered child DOM.
- `hideMode: "subtree"` remains explicit and is the only mode that hides descendants after WebGL readiness.
- Re-entering after far-offscreen disposal rebuilds from DOM/source and hides fallback only after WebGL readiness.
- Effect-owned resources continue to dispose through `ctx.resources`.
- Runtime/package code remains demo-agnostic and does not hardcode demo target keys, asset paths, DOM structure, or copy.

## Self-Review

- Spec coverage: The plan covers viewport lifecycle, WebGL parking, far-offscreen disposal, fallback restore, child DOM ownership, public lifecycle typing, documentation, and verification.
- Placeholder scan: The plan contains no placeholder markers, no unspecified implementation step, and no open-ended test instruction.
- Type consistency: The public names are `WebGLOffscreenStrategy`, `WebGLOffscreenLifecycleDeclaration`, `offscreen.strategy`, and `offscreen.warmTtlMs`; runtime normalization uses `compileOffscreenPolicy`.
