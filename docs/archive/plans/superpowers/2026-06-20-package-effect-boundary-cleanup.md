# Package Effect Boundary Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Phase 8 with the product boundary that the runtime package provides effect authoring primitives only, while every concrete effect implementation lives in consumer code or examples.

**Architecture:** Keep `defineWebGLEffect(...)`, runtime-level `effects`, managed context, source handles, target handles, and lifecycle dispatch in `@project/dom-webgl-runtime`. Remove package-provided effect presets and the `@project/dom-webgl-runtime/effects` subpath. Move the demo's visual effects into `apps/demo` as local consumer examples that use the public authoring API.

**Tech Stack:** TypeScript, Vitest, React demo app, npm workspaces.

---

## Implementation Status

Completed. The package now exposes effect authoring primitives and runtime
plumbing only. It does not ship concrete effect implementations, does not
export an `./effects` subpath, and does not auto-register default visual
effects. The demo owns its sample visual effects locally through public
`defineWebGLEffect(...)` APIs.

## Pre-Cleanup Truth

- `packages/dom-webgl-runtime/src/effects.ts` exports concrete `pointerTiltEffect` and `surfaceBasicEffect` presets.
- `packages/dom-webgl-runtime/package.json` exposes an `./effects` subpath.
- `apps/demo/src/App.tsx` imports presets from the package subpath.
- Active docs still describe "official optional presets", which conflicts with the intended package boundary.

## Target Boundary

- Package provides authoring and runtime plumbing only: `defineWebGLEffect(...)`, runtime-level `effects`, effect context/source/target/resource types, and effect lifecycle execution.
- Package provides no concrete effect implementation and no official effect preset subpath.
- Demo remains a validation surface by defining its own effects locally through public package APIs.
- Docs describe demo/example effects as consumer-owned examples, not runtime/package exports.

## Task 1: Public Export Contract

**Files:**
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/package.json`
- Delete: `packages/dom-webgl-runtime/src/effects.ts`
- Delete: `packages/dom-webgl-runtime/src/lib/effects/presets/index.ts`
- Delete: `packages/dom-webgl-runtime/src/lib/effects/presets/pointerTiltEffect.ts`
- Delete: `packages/dom-webgl-runtime/src/lib/effects/presets/surfaceBasicEffect.ts`

- [x] **Step 1: Write failing export tests**

Change the public exports test so the package root still exposes authoring APIs, but the package has no effect preset subpath and no preset exports.

Expected test assertions:

```ts
expect(rootApi.defineWebGLEffect).toEqual(expect.any(Function));
expect(rootApi).not.toHaveProperty("pointerTiltEffect");
expect(rootApi).not.toHaveProperty("surfaceBasicEffect");
```

Remove the test that imports `./effects`.

- [x] **Step 2: Verify RED**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts -t "public package exports"
```

Expected: FAIL while `./effects` still exists or while package metadata still exports `./effects`.

- [x] **Step 3: Remove package preset surface**

Remove `./effects` from `packages/dom-webgl-runtime/package.json`, delete `src/effects.ts`, and delete `src/lib/effects/presets/*`.

- [x] **Step 4: Verify GREEN**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts -t "public package exports"
```

Expected: PASS.

## Task 2: Demo Consumer-Owned Effects

**Files:**
- Create: `apps/demo/src/demoEffects.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing import-boundary expectations**

Update demo tests and runtime pipeline tests to import demo/example effects from consumer-owned files or define inline custom effects. Remove imports from `../effects/presets` and `@project/dom-webgl-runtime/effects`.

- [x] **Step 2: Verify RED**

Run:

```bash
npm test -- --run apps/demo/src/App.test.tsx packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: FAIL because demo-local effects do not exist yet and runtime pipeline still references deleted presets.

- [x] **Step 3: Add demo-local effect examples**

Create `apps/demo/src/demoEffects.ts`:

```ts
import { defineWebGLEffect } from "@project/dom-webgl-runtime";

export const demoSurfaceEffect = defineWebGLEffect<{
  kind: "demo.surface";
  opacity?: number;
}>({
  kind: "demo.surface",
  source: "snapshot/element",
  update(ctx, _state, params) {
    ctx.target?.setVisible(true);
    ctx.target?.setOpacity(clampNumber(params.opacity, 0, 1, 1));
  },
});

export const demoPointerTiltEffect = defineWebGLEffect<{
  kind: "demo.pointerTilt";
  strength?: number;
  maxDegrees?: number;
}>({
  kind: "demo.pointerTilt",
  update(ctx, _state, params) {
    if (!ctx.pointer.isInside) {
      ctx.target?.setRotation(0, 0);
      return;
    }

    const strength = clampNumber(params.strength, 0, 2, 1);
    const maxDegrees = clampNumber(params.maxDegrees, 0, 30, 8);
    const radians = (maxDegrees * Math.PI) / 180;

    ctx.target?.setRotation(
      -ctx.pointer.normalizedY * radians * strength,
      ctx.pointer.normalizedX * radians * strength,
    );
  },
});

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
```

- [x] **Step 4: Wire demo to local effects**

In `apps/demo/src/App.tsx`, replace package preset imports with:

```ts
import { demoPointerTiltEffect, demoSurfaceEffect } from "./demoEffects";

const demoRuntimeEffects = [demoSurfaceEffect, demoPointerTiltEffect] as const;
```

Change demo effect declarations from `surfaceBasic` / `pointerTilt` to `demo.surface` / `demo.pointerTilt`.

- [x] **Step 5: Update runtime tests to use inline custom effects**

In package tests, define custom test effects inside the test file with `defineWebGLEffect(...)` instead of importing package presets.

- [x] **Step 6: Verify GREEN**

Run:

```bash
npm test -- --run apps/demo/src/App.test.tsx packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

## Task 3: Documentation Truth Sweep

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/superpowers/plans/2026-06-19-phase-8-custom-effect-authoring-api.md`
- Modify: `docs/superpowers/plans/2026-06-20-package-effect-boundary-cleanup.md`

- [x] **Step 1: Replace package preset language**

Replace active docs language that says official visuals or optional presets are exported from `@project/dom-webgl-runtime/effects` with language that says concrete effects are examples owned by consumers.

- [x] **Step 2: Preserve historical context explicitly**

When historical Phase 7/8 text mentions old registry or preset decisions, label it as superseded by the package boundary cleanup instead of leaving it as current guidance.

- [x] **Step 3: Search stale claims**

Run:

```bash
rg -n "surfaceBasicEffect|pointerTiltEffect|@project/dom-webgl-runtime/effects|optional presets|official visuals|package preset|presets" README.md docs/00-goal.md docs/EXECUTION_STATE.md docs/superpowers/plans packages/dom-webgl-runtime/src apps/demo/src
```

Expected: no active package-export claims remain. Historical plan matches must be clearly marked superseded.

## Task 4: Final Verification

**Files:**
- Verify all modified package, demo, and docs files.

- [x] **Step 1: Run targeted tests**

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts apps/demo/src/App.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run full verification**

```bash
npm run typecheck
npm test -- --run
npm run build
npm run check:imports
git diff --check
```

Expected: all pass, except the existing non-blocking Vite chunk-size warning may remain during build.

- [x] **Step 3: Inspect diff**

```bash
git diff --stat
git diff -- packages/dom-webgl-runtime/package.json packages/dom-webgl-runtime/src/publicExports.test.ts apps/demo/src/App.tsx apps/demo/src/demoEffects.ts README.md docs/00-goal.md docs/EXECUTION_STATE.md
```

Expected: package no longer exports concrete effects; demo owns examples; docs match the boundary.
