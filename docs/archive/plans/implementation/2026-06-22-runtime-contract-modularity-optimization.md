# Runtime Contract And Modularity Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduce coupling and fix verified contract gaps without silently changing public behavior.

**Architecture:** Separate functional decisions from mechanical refactors. Any behavior change must pass a user decision gate first; behavior-preserving refactors can proceed behind compatibility import paths and targeted regression tests.

**Tech Stack:** TypeScript, React, Three.js, Vitest, existing `@project/dom-webgl-runtime` workspace packages.

---

## Required User Decision Gates

Do not implement unresolved decision branches until the user explicitly chooses
the behavior.

### Decision 1: React Same-Key Declaration Changes

Status: **Chosen B on 2026-06-22. Stable key means immutable declaration.**
Document the static declaration contract and do not change React/runtime behavior
in this plan.

Current behavior:

- `<WebGLTarget webgl={...}>` registers on mount.
- It does not re-register when `webgl.source`, `webgl.effects`, `webgl.lifecycle`, or `webgl.scroll` changes under the same `webgl.key`.
- It also intentionally avoids re-registering when an equivalent inline declaration object is recreated.

Resolved user decision:

- Same-key declaration content changes should not be supported for now.
- Document that `webgl.source`, `webgl.effects`, `webgl.lifecycle`,
  `webgl.pointer`, and `webgl.scroll` are registration-time static under a
  stable `webgl.key`.
- If consumers need a different declaration, they should change the key or
  remount the target.

### Decision 2: Explicit Image/Video Source On Non-Media Elements

Status: **Chosen C on 2026-06-22. Keep image/video tied to real media elements
and throw when a non-media target explicitly declares image/video source.**

Current behavior:

- Public types allow `{ kind: "image", src?: string }` and `{ kind: "video", src?: string }`.
- Runtime only creates image/video renderables when the target DOM element is actually `img` or `video`.
- A non-media element with `source: { kind: "image", src: "..." }` currently falls through to snapshot behavior instead of loading that `src`.

Resolved user decision:

- Do not add internal image/video element creation for non-media layout anchors.
- `<img>` targets may use `source: { kind: "image", src?: string }`.
- `<video>` targets may use `source: { kind: "video", src?: string }`.
- Any other element that explicitly declares `source.kind: "image"` or
  `source.kind: "video"` should fail loudly instead of falling back to snapshot.

### Decision 3: Legacy Object-Form Effects

Status: **Chosen on 2026-06-22. Remove object-form legacy effects and keep only
array-form effect declarations.**

Resolved user decision:

- Remove public `effects: { material, motion }` compatibility.
- Keep only `effects: [{ kind: "app.xxx", ...params }]`.
- Concrete effects remain application-owned and registered through runtime-level
  `effects`.

---

## Approved Contract Changes And Modular Refactors

Task 2 and Task 2B are contract changes approved by the decision gates above.
Tasks 3-7 are bug fixes or behavior-preserving modularity refactors.

### Task 1: Document Static WebGL Declaration Contract

**Files:**
- Modify: `docs/agent/package-usage.md`
- Modify: `README.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Document the static target declaration contract**

Record that `webgl.source`, `webgl.effects`, `webgl.lifecycle`, `webgl.pointer`,
and `webgl.scroll` are registration-time static under a stable `webgl.key`.

- [x] **Step 2: Document the consumer action**

When declaration content needs to change, consumers should use a different key
or remount the target. Do not add dynamic declaration re-registration in this
plan.

### Task 2: Reject Invalid Explicit Media Sources

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
- Modify: `docs/agent/package-usage.md`
- Modify: `README.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Write failing tests**

Add tests proving explicit media declarations fail on non-media elements:

```ts
  test("rejects explicit image declarations on non-image elements", () => {
    const element = document.createElement("div");
    const target = createTargetDescriptor(
      element,
      {
        key: "hero.image",
        source: { kind: "image", src: "/images/hero.png" },
      },
      0,
    );

    expect(() => inferSourceDescriptor(target)).toThrow(
      'WebGL target "hero.image" declares an image source but is not an IMG element.',
    );
  });

  test("rejects explicit video declarations on non-video elements", () => {
    const element = document.createElement("section");
    const target = createTargetDescriptor(
      element,
      {
        key: "hero.video",
        source: { kind: "video", src: "/videos/intro.mp4" },
      },
      0,
    );

    expect(() => inferSourceDescriptor(target)).toThrow(
      'WebGL target "hero.video" declares a video source but is not a VIDEO element.',
    );
  });
```

- [x] **Step 2: Run failure check**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts -t "rejects explicit"
```

Expected: FAIL until inference rejects invalid explicit media declarations.

- [x] **Step 3: Implement explicit media validation**

In `inferSourceDescriptor(...)`, handle explicit image/video declarations before
DOM-native fallback:

```ts
  if (declaredSource?.kind === "image") {
    if (!isImageElement(element)) {
      throw new Error(
        `WebGL target "${targetDescriptor.key}" declares an image source but is not an IMG element.`,
      );
    }

    return {
      kind: "image",
      element,
      src: declaredSource.src ?? readElementSrc(element),
    };
  }

  if (declaredSource?.kind === "video") {
    if (!isVideoElement(element)) {
      throw new Error(
        `WebGL target "${targetDescriptor.key}" declares a video source but is not a VIDEO element.`,
      );
    }

    return {
      kind: "video",
      element,
      src: declaredSource.src ?? readElementSrc(element),
    };
  }
```

- [x] **Step 4: Verify**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
npm run typecheck
```

Expected: PASS.

### Task 2B: Remove Legacy Object-Form Effects

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Modify: `docs/agent/package-usage.md`
- Modify: `README.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Write failing public type tests**

Update public type fixtures so object-form declarations are rejected:

```ts
        const arrayEffects = [
          { kind: "app.surface", opacity: 0.86 },
          { kind: "app.pointerTilt", strength: 0.6, maxDegrees: 8 },
        ] satisfies WebGLEffectsDeclaration;

        // @ts-expect-error legacy object-form effects are no longer public contract.
        const legacyEffects = {
          material: { kind: "solid", color: 0x111827, opacity: 0.82 },
          motion: { kind: "pointer-tilt", strength: 0.6, maxDegrees: 8 },
        } satisfies WebGLEffectsDeclaration;
```

- [x] **Step 2: Write failing runtime declaration tests**

Update `effectDeclaration.test.ts` so object-form declarations are rejected:

```ts
  test("rejects legacy object-form effects", () => {
    expect(() =>
      compileWebGLEffectDeclarations({
        material: { kind: "solid" },
      } as never),
    ).toThrow("WebGL effects must be declared as an array of effect entries.");
  });
```

- [x] **Step 3: Run failure checks**

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts
```

Expected: FAIL until types and declaration compilation remove legacy object-form support.

- [x] **Step 4: Remove legacy public types**

In `types.ts`, remove:

- `WebGLMaterialDeclaration`
- `WebGLMotionDeclaration`
- `WebGLSurfaceBasicEffectDeclaration`
- `WebGLSolidMaterialEffectDeclaration`
- `WebGLPointerTiltEffectDeclaration`
- `WebGLBuiltInEffectDeclaration`
- `WebGLLegacyEffectsDeclaration`

Then define:

```ts
export type WebGLEffectDeclaration = WebGLCustomEffectDeclaration;

export type WebGLEffectsDeclaration = readonly WebGLEffectDeclaration[];
```

- [x] **Step 5: Remove legacy compiler path**

Replace `compileWebGLEffectDeclarations(...)` with array-only behavior:

```ts
import type {
  WebGLEffectDeclaration,
  WebGLEffectsDeclaration,
} from "../types";

export function compileWebGLEffectDeclarations(
  declaration: WebGLEffectsDeclaration | undefined,
): WebGLEffectDeclaration[] {
  if (!declaration) {
    return [];
  }

  if (!Array.isArray(declaration)) {
    throw new Error(
      "WebGL effects must be declared as an array of effect entries.",
    );
  }

  return [...declaration];
}
```

- [x] **Step 6: Verify**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts apps/demo/src/App.test.tsx
npm run typecheck
npm run check:imports
```

Expected: PASS. Demo declarations must already use array-form effects.

### Task 3: Cap Model Vertex Sampling Across Multiple Meshes

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`

- [x] **Step 1: Write the failing test**

Add this test:

```ts
  test("caps sampled vertices across multiple meshes", () => {
    const root = new Group();
    const firstGeometry = new BufferGeometry();
    firstGeometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([1, 0, 0, 2, 0, 0]), 3),
    );
    const secondGeometry = new BufferGeometry();
    secondGeometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([3, 0, 0, 4, 0, 0]), 3),
    );
    root.add(new Mesh(firstGeometry, new MeshBasicMaterial()));
    root.add(new Mesh(secondGeometry, new MeshBasicMaterial()));

    const vertices = createModelEffectHandle(root).sampleVertices({
      maxPoints: 1,
    });

    expect(vertices.length).toBe(3);
  });
```

- [x] **Step 2: Run failure check**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts -t "caps sampled vertices"
```

Expected: FAIL until sampling is globally capped.

- [x] **Step 3: Implement strict global cap**

In `sampleModelVertices(...)`, track a single `sampledPoints` counter across the whole traversal and stop pushing when it reaches `maxPoints`.

- [x] **Step 4: Verify**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts apps/demo/src/demoEffects.test.ts -t "glbVertexParticles|ModelEffectHandle|caps sampled vertices"
npm run typecheck
```

Expected: PASS.

### Task 4: Index Text Glyph Commands By Glyph Id

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`

- [x] **Step 1: Add behavior-preserving test**

Add a test that passes glyphs out of order and commands by index, then asserts output order still follows command order.

- [x] **Step 2: Replace repeated `find`**

Before the command loop in `drawTextGlyphCommands(...)`, build:

```ts
  const glyphsByIndex = new Map(
    options.getGlyphs().map((glyph) => [glyph.index, glyph] as const),
  );
```

Use `glyphsByIndex.get(command.index)` in the loop.

- [x] **Step 3: Verify**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts apps/demo/src/demoEffects.test.ts -t "text|glyph|scrambled|pressure|capabilityTextLayer"
npm run typecheck
```

Expected: PASS.

### Task 5: Extract Shared Object3D Controls

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/object3DControls.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`

- [x] **Step 1: Create internal helper**

Move duplicated visibility, position, rotation, scale, opacity, and material opacity helper logic into `object3DControls.ts`.

- [x] **Step 2: Replace local helpers**

Use the shared helper in source capability handles, element plane effect targets, and model effect handles. Preserve existing plane defaults:

- element plane scale default z stays `1`;
- object/model scale default z stays `x`.

- [x] **Step 3: Verify**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts
npm run typecheck
```

Expected: PASS.

### Task 6: Split Scene Renderable Object By Source Kind

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableController.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`

- [x] **Step 1: Move base controller**

Move base `SceneRenderableObject`, `SceneRenderableControllerOptions`, `SceneRenderableController`, and `createSceneRenderableController(...)` into `sceneRenderableController.ts`.

- [x] **Step 2: Preserve import compatibility**

Keep `sceneRenderableObject.ts` as a compatibility barrel exporting the same public internal symbols used by existing renderables.

- [x] **Step 3: Move one source-kind controller at a time**

Move:

- element plane code to `elementPlaneSceneRenderable.ts`;
- text plane code to `textPlaneSceneRenderable.ts`;
- texture plane code to `texturePlaneSceneRenderable.ts`;
- model fit/layout code to `modelSceneRenderable.ts`.

- [x] **Step 4: Verify after each move**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts
npm run typecheck
```

Expected: PASS after every move.

### Task 7: Extract Target Runtime State From Runtime Orchestrator

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/renderer/targetRuntimeState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Create target state container**

Move per-target maps out of `runtime.ts` into `createTargetRuntimeState(...)`:

- renderables;
- retired renderables;
- renderables by target key;
- parked timestamps and visibility;
- effect visibility;
- lifecycle versions;
- effect controllers;
- fallback controllers.

- [x] **Step 2: Move disposal/bookkeeping helpers**

Move these helpers into `targetRuntimeState.ts`:

- target renderable disposal;
- offscreen renderable disposal;
- tracked effect controller disposal;
- lifecycle version reads/bumps;
- fallback visibility restore helpers.

- [x] **Step 3: Keep behavior unchanged**

`runtime.ts` remains the top-level orchestrator. Do not change renderer loop, scroll controller, pointer controller, or debug state semantics in this task.

- [x] **Step 4: Verify**

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtime.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
npm run typecheck
```

Expected: PASS.

---

## Final Verification

Status: **Complete on 2026-06-22.**

Run after the selected tasks:

```bash
npm run check
npm run build
npm run check:imports
git diff --check
```

Expected:

- TypeScript passes.
- Vitest passes.
- Workspace build passes.
- Demo public import boundary passes.
- Whitespace diff check passes.

Actual verification:

- `npm run check` passed: 70 test files / 371 tests.
- `npm run build` passed for runtime, scroll adapters, and demo.
- `npm run check:imports` passed with `Demo import boundary OK`.
- `git diff --check` passed.

## Execution Order

1. Record Decisions 1-3 before implementation.
2. Complete Task 1 docs-only alignment for static `webgl` declarations.
3. Implement Task 2, rejecting explicit image/video declarations on non-media elements.
4. Implement Task 2B, removing legacy object-form effects while verifying demo declarations stay array-form.
5. Implement Task 3 and Task 4 as small bug/perf fixes.
6. Implement Task 5 before Task 6 to reduce duplicated control helpers.
7. Implement Task 6 as a move-only refactor behind compatibility exports.
8. Implement Task 7 only after Task 6 is green.
9. Update README, `docs/EXECUTION_STATE.md`, and `docs/agent/package-usage.md` to match the final code after each implemented contract change.
