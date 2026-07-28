# Runtime Render Quality Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in managed renderer antialiasing and DPR caps, then enable them only for `apps/hero-next`.

**Architecture:** Normalize one public `renderQuality` declaration at runtime creation, pass the normalized policy to the internal Three renderer host and layout pass, and forward the declaration through the React adapters. Preserve the current performance defaults and keep all renderer/context ownership private.

**Tech Stack:** TypeScript, React, Three.js, Vitest, Next.js, npm workspaces.

## Global Constraints

- Default behavior remains `antialias: false` and `maxDevicePixelRatio: 1.5`.
- `maxDevicePixelRatio` rejects non-finite and non-positive values before renderer creation.
- Do not expose raw Three.js renderer, context, scene, camera, material, or render-target handles.
- `apps/hero-next` uses only public package entrypoints and keeps CSS layout-only.
- Preserve all unrelated user changes and generated `apps/hero-next/next-env.d.ts` state.

---

### Task 1: Normalize Render Quality And Drive The Renderer

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/renderQuality.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/renderQuality.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/layoutPass.test.ts`

**Interfaces:**
- Produces: `WebGLRenderQualityDeclaration` and `normalizeWebGLRenderQuality(...)`.
- Produces normalized `{ antialias: boolean; maxDevicePixelRatio: number }` for renderer and layout consumers.

- [x] **Step 1: Write failing normalization, renderer-construction, and DPR-cap tests**

```ts
expect(normalizeWebGLRenderQuality()).toEqual({
  antialias: false,
  maxDevicePixelRatio: 1.5,
});
expect(normalizeWebGLRenderQuality({ antialias: true, maxDevicePixelRatio: 2 }))
  .toEqual({ antialias: true, maxDevicePixelRatio: 2 });
expect(() => normalizeWebGLRenderQuality({ maxDevicePixelRatio: 0 })).toThrow(
  "WebGL render quality maxDevicePixelRatio must be a finite positive number.",
);
```

Extend renderer and layout tests so an opt-in cap of `2` produces
`antialias: true`, renderer DPR `2`, and layout snapshot DPR `2` on a DPR-3
environment.

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/renderQuality.test.ts packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts packages/dom-webgl-runtime/test/lib/renderer/layoutPass.test.ts
```

Expected: FAIL because the declaration, normalizer, and configurable cap do not exist.

- [x] **Step 3: Implement the minimal normalized policy and internal renderer wiring**

Add the public declaration to `types.ts`, implement `normalizeWebGLRenderQuality`, let
`capDevicePixelRatio(devicePixelRatio, maximum = 1.5)` accept the normalized
maximum, and let `createThreeRendererHost` use the policy for context creation and
resize.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

### Task 2: Thread Render Quality Through Runtime And React

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtime.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

**Interfaces:**
- Consumes: `WebGLRuntimeOptions.renderQuality` and `normalizeWebGLRenderQuality(...)`.
- Produces: public root type export and React `renderQuality` prop forwarding.

- [x] **Step 1: Write failing runtime, React-forwarding, recreation, and public-type tests**

Add tests proving `createWebGLRuntime` rejects invalid quality before renderer-host
creation, `WebGLRuntime` forwards a stable declaration, a changed reference recreates
the runtime, and the root/React TypeScript fixtures accept the new type/prop.

- [x] **Step 2: Run tests and verify RED**

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: FAIL because `renderQuality` is not yet accepted or forwarded.

- [x] **Step 3: Implement runtime and React forwarding**

Normalize once in `createWebGLRuntime`, pass the policy to `createThreeRendererHost`
and `createLayoutPass`, export the public type, add `renderQuality` to
`WebGLRuntimeProps`, forward it into `createWebGLRuntime`, and include it in the
layout-effect dependency list.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

### Task 3: Enable Quality Rendering In Hero Next And Sync Docs

**Files:**
- Modify: `apps/hero-next/src/HeroExperience.tsx`
- Modify: `apps/hero-next/test/HeroExperience.test.tsx`
- Modify: `apps/hero-next/test/heroGhostEffects.test.ts`
- Modify: `apps/hero-next/AGENTS.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/superpowers/specs/2026-07-14-hero-next-webglmesh-tetrahedron-design.md`
- Modify: `skills/viselora-dom-webgl/references/api-surface.generated.md`

**Interfaces:**
- Consumes: public `WebGLRenderQualityDeclaration` and React `renderQuality` prop.
- Produces: hero-next opt-in `{ antialias: true, maxDevicePixelRatio: 2 }`.

- [x] **Step 1: Write the failing hero contract test**

Update the `WebGLScrollRuntime` mock to serialize `renderQuality` and assert the
server-rendered hero contains `antialias=true` and `maxDevicePixelRatio=2`.

- [x] **Step 2: Run the hero test and verify RED**

```bash
npm test -- --run apps/hero-next/test/HeroExperience.test.tsx
```

Expected: FAIL because hero-next does not pass `renderQuality`.

- [x] **Step 3: Add the stable hero declaration and synchronize active docs**

Import the public type, define a module-scope declaration with `satisfies`, pass it
to `WebGLScrollRuntime`, and document defaults, opt-in behavior, stable-reference
requirements, the hero setting, and the performance trade-off.

- [x] **Step 4: Run focused hero tests and verify GREEN**

```bash
npm test -- --run apps/hero-next/test
```

Expected: all hero-next tests pass.

### Task 4: Full Verification And Commit

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: all preceding tasks.
- Produces: one verified implementation commit with no generated-file churn.

- [x] **Step 1: Run the full repository verification chain**

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
npm run verify:skill
npm run verify:tarballs
npm run verify:consumer
git diff --check
```

Expected: every command exits `0` with no failed tests or type errors.

- [x] **Step 2: Check generated files, public boundary, and secrets**

Confirm `apps/hero-next/next-env.d.ts` matches its pre-verification hash, only intended
source/tests/docs changed, and no token, key, local config, build artifact, or temp
fixture is staged.

- [x] **Step 3: Commit**

```bash
git add \
  packages/dom-webgl-runtime/src/index.ts \
  packages/dom-webgl-runtime/src/lib/types.ts \
  packages/dom-webgl-runtime/src/lib/renderer/renderQuality.ts \
  packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts \
  packages/dom-webgl-runtime/src/lib/renderer/layoutPass.ts \
  packages/dom-webgl-runtime/src/lib/renderer/runtime.ts \
  packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx \
  packages/dom-webgl-runtime/test/lib/renderer/renderQuality.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/layoutPass.test.ts \
  packages/dom-webgl-runtime/test/lib/renderer/runtime.test.ts \
  packages/dom-webgl-runtime/test/lib/react/WebGLRuntime.test.tsx \
  packages/dom-webgl-runtime/test/publicExports.test.ts \
  apps/hero-next/src/HeroExperience.tsx \
  apps/hero-next/test/HeroExperience.test.tsx \
  apps/hero-next/test/heroGhostEffects.test.ts \
  apps/hero-next/AGENTS.md \
  README.md docs/README.md docs/STATUS.md \
  docs/agent/package-onboarding.md docs/agent/package-usage.md \
  docs/superpowers/specs/2026-07-14-hero-next-webglmesh-tetrahedron-design.md \
  docs/superpowers/specs/2026-07-16-runtime-render-quality-design.md \
  docs/superpowers/plans/2026-07-16-runtime-render-quality.md \
  skills/viselora-dom-webgl/references/api-surface.generated.md
git commit -m "feat: add opt-in render quality controls"
```
