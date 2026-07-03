# Controlled Effect Object Facade Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor custom effect authoring around one controlled Three-like `ctx.object` facade so AI-agent and human consumers can write familiar Three.js-style effects while the runtime keeps raw Three.js internals private.

**Architecture:** Keep `defineWebGLEffect(...)` and runtime-level `effects` as the authoring entrypoint. Add a runtime-owned object facade that adapts existing target/source/visual/resource handles behind one public object. Stop expanding source-specific public handles; new capabilities attach under `ctx.object` and are implemented by focused internal modules.

**Tech Stack:** TypeScript, npm workspaces, Three.js internals hidden behind package modules, Vitest/jsdom, public TypeScript fixtures in `packages/dom-webgl-runtime/test/publicExports.test.ts`.

---

## Scope And Boundary

This plan intentionally allows a large refactor. Do not preserve the old
source-handle mental model just to avoid touching many files.

Keep:

- one runtime canvas per runtime instance;
- runtime-owned scroll, keyed progress, pointer input, resource loading,
  fallback visibility, render loop, scheduling, and performance warnings;
- `defineWebGLEffect(...)` as the effect definition API;
- target-level `effects: [{ kind, ...params }]` declarations;
- raw Three.js renderer, scene, camera, Object3D, mesh, material, texture,
  loader, mixer, raycaster, composer, render target, and pass objects internal.

Change:

- make `ctx.object` the primary public effect authoring handle;
- move Three-like transform/visibility/opacity operations to `ctx.object`;
- move source-backed capabilities under optional modules on `ctx.object`;
- update docs and examples to teach object-first authoring;
- add public tests that prevent future source-specific capability sprawl.

Do not implement model decoder/loader work in this refactor unless it is needed
for tests. Runtime-owned model asset loading remains a separate asset-layer
capability. Model animation, picking, lights, material variants, and sampling
must be designed under `ctx.object`, not added directly to `ctx.source.model`.

## Current Truth To Preserve While Refactoring

- `WebGLEffectContext` currently exposes `ctx.source`, `ctx.target`,
  `ctx.visual`, `ctx.resources`, `ctx.pointer`, `ctx.targetPointer`,
  `ctx.progress`, `ctx.time`, and `ctx.delta`.
- `ctx.target` writes runtime scene-object transform/visibility/opacity.
- `ctx.source` exposes source-specific output handles for `dom/element`,
  `dom/text`, `media/image`, `media/video`, `media/image-sequence`, and
  `model/glb`.
- `ctx.visual.requestPostprocess(...)` owns named runtime postprocess requests.
- Existing example effects and tests use these handles directly.

The refactor can keep old fields during a transition, but docs and examples
should move to `ctx.object` as soon as each equivalent capability exists.

## File Structure

Create focused modules under `packages/dom-webgl-runtime/src/lib/effects/`:

- `effectObject.ts`: public facade types only.
- `effectObjectTransform.ts`: mutable Three-like vector/euler/scale facades and
  target transform adapters.
- `effectObjectCapabilities.ts`: source-handle-to-object capability mapping.
- `effectObjectContext.ts`: `createWebGLEffectObject(...)` assembly function.

Modify:

- `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`: add public
  `WebGLEffectObjectHandle` types to `WebGLEffectContext`.
- `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`: create and
  attach `ctx.object`.
- `packages/dom-webgl-runtime/src/index.ts`: export controlled facade types.
- `packages/dom-webgl-runtime/test/publicExports.test.ts`: public type fixtures
  and raw Three.js negative checks.
- `packages/dom-webgl-runtime/test/lib/effects/effectObject*.test.ts`: focused
  unit tests for facade behavior.
- `apps/example/src/*Effects.ts`: migrate dogfood effects to object-first
  authoring where the facade supports it.
- `docs/agent/package-usage.md`, `docs/agent/package-onboarding.md`,
  `docs/agent/custom-effects.md`, `docs/examples/effect-authoring.md`,
  `README.md`, `docs/00-goal.md`, `docs/EXECUTION_STATE.md`, and `AGENTS.md`:
  align docs after each public milestone.

## Public Facade Shape

Use this as the target public shape unless implementation reveals a concrete
conflict:

```ts
export type WebGLEffectVector3Like = {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z?: number): void;
};

export type WebGLEffectScaleLike = WebGLEffectVector3Like & {
  setScalar(value: number): void;
};

export type WebGLEffectPostprocessFacade = {
  request(request: WebGLEffectPostprocessRequest): WebGLEffectPostprocessHandle;
};

export type WebGLEffectTextureFacade = {
  setTransform(transform: WebGLEffectTextureTransform): void;
  invalidate(): void;
  material: WebGLEffectMaterialLayerHost;
};

export type WebGLEffectTextFacade = {
  readonly text: string;
  getGlyphs(): readonly WebGLTextGlyph[];
  setText(text: string): void;
  setGlyphs(
    transform: (
      glyphs: readonly WebGLTextGlyph[],
    ) => readonly WebGLTextGlyphRenderCommand[],
  ): void;
  material: WebGLEffectMaterialLayerHost;
};

export type WebGLEffectModelMeshesFacade = {
  all(): readonly WebGLModelMeshHandle[];
  forEach(visitor: (mesh: WebGLModelMeshHandle) => void): void;
};

export type WebGLEffectModelSamplingFacade = {
  vertices(options?: { maxPoints?: number }): Float32Array;
};

export type WebGLEffectModelPointsFacade = {
  create(options: WebGLEffectPointLayerOptions): WebGLEffectManagedObjectHandle;
};

export type WebGLEffectModelFacade = {
  meshes: WebGLEffectModelMeshesFacade;
  sampling: WebGLEffectModelSamplingFacade;
  points: WebGLEffectModelPointsFacade;
};

export type WebGLEffectObjectHandle = {
  readonly sourceKind: WebGLEffectSourceKind;
  position: WebGLEffectVector3Like;
  rotation: WebGLEffectVector3Like;
  scale: WebGLEffectScaleLike;
  visible: boolean;
  opacity: number;
  surface?: WebGLEffectCanvasSurfaceHandle;
  text?: WebGLEffectTextFacade;
  texture?: WebGLEffectTextureFacade;
  video?: WebGLEffectVideoLayerHandle;
  model?: WebGLEffectModelFacade;
  postprocess: WebGLEffectPostprocessFacade;
};
```

This shape deliberately keeps existing low-level capabilities available through
one object while moving the author's first decision from "which source handle do
I narrow to?" to "which capability does this object have?".

## Task 1: Public Contract RED Tests

**Files:**

- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts`

- [x] **Step 1: Add a public type fixture for `ctx.object`**

Add this fixture inside the existing root public type-check test string in
`packages/dom-webgl-runtime/test/publicExports.test.ts`:

```ts
const objectEffect = defineWebGLEffect({
  kind: "custom.object",
  update(ctx) {
    ctx.object.position.set(1, 2, 3);
    ctx.object.position.y += 4;
    ctx.object.rotation.set(0, 0.5, 0);
    ctx.object.scale.setScalar(1.1);
    ctx.object.visible = true;
    ctx.object.opacity = 0.75;
    ctx.object.postprocess.request({
      key: "custom.glow",
      bloom: { strength: 0.2 },
    });
  },
});

objectEffect satisfies WebGLEffectDefinition;
```

- [x] **Step 2: Add negative public raw Three checks**

In the same fixture, add these negative checks:

```ts
// @ts-expect-error raw object3D is not public.
declare const rawObject: WebGLEffectContext["object"]["object3D"];
// @ts-expect-error raw mesh is not public.
declare const rawMesh: WebGLEffectContext["object"]["mesh"];
// @ts-expect-error raw material is not public.
declare const rawMaterial: WebGLEffectContext["object"]["material"];
// @ts-expect-error raw texture is not public.
declare const rawTexture: WebGLEffectContext["object"]["texture"];
// @ts-expect-error raw renderer is not public.
declare const rawRenderer: WebGLEffectContext["object"]["renderer"];
// @ts-expect-error raw scene is not public.
declare const rawScene: WebGLEffectContext["object"]["scene"];
// @ts-expect-error raw camera is not public.
declare const rawCamera: WebGLEffectContext["object"]["camera"];
```

- [x] **Step 3: Add an authoring test that demonstrates the desired syntax**

Append this test to
`packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts`:

```ts
test("supports object-first effect authoring syntax", () => {
  const definition = defineWebGLEffect({
    kind: "custom.objectSyntax",
    update(ctx) {
      ctx.object.position.y += Math.sin(ctx.time / 1000) * 8;
      ctx.object.rotation.y += ctx.delta / 1000;
      ctx.object.scale.setScalar(1.05);
      ctx.object.opacity = 0.9;
    },
  });

  expect(definition.kind).toBe("custom.objectSyntax");
});
```

- [x] **Step 4: Run RED verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts
```

Expected: fail with TypeScript diagnostics equivalent to
`Property 'object' does not exist on type 'WebGLEffectContext'`.

## Task 2: Public Effect Object Types

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Create public facade types**

Create `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts` with the
public types from the "Public Facade Shape" section. Import only public effect
handle types from `effectAuthoring.ts`. Do not import `three`.

- [x] **Step 2: Add `object` to `WebGLEffectContext`**

In `effectAuthoring.ts`, import `WebGLEffectObjectHandle` as a type and add:

```ts
object: WebGLEffectObjectHandle;
```

to `WebGLEffectContext`.

- [x] **Step 3: Export the facade types**

In `packages/dom-webgl-runtime/src/index.ts`, export:

```ts
export type {
  WebGLEffectModelFacade,
  WebGLEffectModelMeshesFacade,
  WebGLEffectModelPointsFacade,
  WebGLEffectModelSamplingFacade,
  WebGLEffectObjectHandle,
  WebGLEffectPostprocessFacade,
  WebGLEffectScaleLike,
  WebGLEffectTextFacade,
  WebGLEffectTextureFacade,
  WebGLEffectVector3Like,
} from "./lib/effects/effectObject";
```

- [x] **Step 4: Run type tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/effects/effectAuthoring.test.ts
```

Expected: fail only where runtime context construction has not created
`object` yet.

## Task 3: Transform, Visibility, And Opacity Facade

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectObjectTransform.ts`
- Create: `packages/dom-webgl-runtime/test/lib/effects/effectObjectTransform.test.ts`

- [x] **Step 1: Write tests for Three-like mutation syntax**

Create `packages/dom-webgl-runtime/test/lib/effects/effectObjectTransform.test.ts`
with tests covering `set`, property mutation, `setScalar`, visibility, and
opacity:

```ts
import { describe, expect, test } from "vitest";

import { createEffectObjectTransform } from "../../../src/lib/effects/effectObjectTransform";
import type { WebGLEffectTargetHandle } from "../../../src/lib/effects/effectAuthoring";

describe("createEffectObjectTransform", () => {
  test("maps position mutation to the target handle", () => {
    const calls: string[] = [];
    const target = createTarget(calls);
    const transform = createEffectObjectTransform(target);

    transform.position.set(1, 2, 3);
    transform.position.y += 4;

    expect(calls).toEqual([
      "position:1,2,3",
      "position:1,6,3",
    ]);
  });

  test("maps rotation, scale, visibility, and opacity", () => {
    const calls: string[] = [];
    const target = createTarget(calls);
    const transform = createEffectObjectTransform(target);

    transform.rotation.y += 0.5;
    transform.scale.setScalar(1.25);
    transform.visible = false;
    transform.opacity = 0.4;

    expect(calls).toEqual([
      "rotation:0,0.5,0",
      "scale:1.25,1.25,1.25",
      "visible:false",
      "opacity:0.4",
    ]);
  });
});

function createTarget(calls: string[]): WebGLEffectTargetHandle {
  return {
    setVisible(visible) {
      calls.push(`visible:${visible}`);
    },
    setPosition(x, y, z = 0) {
      calls.push(`position:${x},${y},${z}`);
    },
    setRotation(x, y, z = 0) {
      calls.push(`rotation:${x},${y},${z}`);
    },
    setScale(x, y = x, z = 1) {
      calls.push(`scale:${x},${y},${z}`);
    },
    setOpacity(opacity) {
      calls.push(`opacity:${opacity}`);
    },
  };
}
```

- [x] **Step 2: Run RED verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectTransform.test.ts
```

Expected: fail because `effectObjectTransform.ts` does not exist.

- [x] **Step 3: Implement the transform facade**

Implement `createEffectObjectTransform(target)` so each property setter calls
the corresponding `WebGLEffectTargetHandle` method. When `target` is undefined,
mutations should update local values and no-op safely.

Expose this return type:

```ts
export type WebGLEffectObjectTransform = {
  position: WebGLEffectVector3Like;
  rotation: WebGLEffectVector3Like;
  scale: WebGLEffectScaleLike;
  visible: boolean;
  opacity: number;
};
```

- [x] **Step 4: Run GREEN verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectTransform.test.ts
```

Expected: pass.

## Task 4: Assemble `ctx.object`

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectObjectContext.ts`
- Create: `packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`

- [x] **Step 1: Write object assembly tests**

Create `packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts`
with a test that builds an object from target, source, visual, and resources:

```ts
import { describe, expect, test } from "vitest";

import { createWebGLEffectObject } from "../../../src/lib/effects/effectObjectContext";
import type {
  WebGLEffectSourceHandle,
  WebGLEffectTargetHandle,
  WebGLEffectVisualContext,
} from "../../../src/lib/effects/effectAuthoring";

describe("createWebGLEffectObject", () => {
  test("creates a controlled object facade with transform and postprocess", () => {
    const targetCalls: string[] = [];
    const postprocessCalls: string[] = [];
    const source = {
      kind: "dom",
      type: "element",
      element: document.createElement("div"),
    } satisfies WebGLEffectSourceHandle;

    const object = createWebGLEffectObject({
      sourceKind: "dom/element",
      source,
      target: createTarget(targetCalls),
      visual: createVisual(postprocessCalls),
    });

    object.position.set(4, 5, 6);
    object.postprocess.request({ key: "soft", grain: { amount: 0.1 } });

    expect(object.sourceKind).toBe("dom/element");
    expect(targetCalls).toEqual(["position:4,5,6"]);
    expect(postprocessCalls).toEqual(["soft"]);
  });
});

function createTarget(calls: string[]): WebGLEffectTargetHandle {
  return {
    setVisible() {},
    setPosition(x, y, z = 0) {
      calls.push(`position:${x},${y},${z}`);
    },
    setRotation() {},
    setScale() {},
    setOpacity() {},
  };
}

function createVisual(calls: string[]): WebGLEffectVisualContext {
  return {
    requestPostprocess(request) {
      calls.push(request.key);
      return {
        update() {},
        dispose() {},
      };
    },
  };
}
```

- [x] **Step 2: Run RED verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts
```

Expected: fail because `effectObjectContext.ts` does not exist.

- [x] **Step 3: Implement `createWebGLEffectObject(...)`**

Create `effectObjectContext.ts` with:

```ts
export type WebGLEffectObjectOptions = {
  sourceKind: WebGLEffectSourceKind;
  source: WebGLEffectSourceHandle;
  target?: WebGLEffectTargetHandle;
  visual: WebGLEffectVisualContext;
};

export function createWebGLEffectObject(
  options: WebGLEffectObjectOptions,
): WebGLEffectObjectHandle {
  const transform = createEffectObjectTransform(options.target);

  return {
    sourceKind: options.sourceKind,
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
    get visible() {
      return transform.visible;
    },
    set visible(value) {
      transform.visible = value;
    },
    get opacity() {
      return transform.opacity;
    },
    set opacity(value) {
      transform.opacity = value;
    },
    postprocess: {
      request(request) {
        return options.visual.requestPostprocess(request);
      },
    },
  };
}
```

Then extend it in Task 5 with source capabilities.

- [x] **Step 4: Attach object to effect context**

In `effectContext.ts`, create the object once inside
`createWebGLEffectContext(...)` after wrapping `visual`:

```ts
const visual = createResourceManagedVisualContext(
  options.visual ?? emptyVisualContext,
  options.resources,
);

return {
  // existing fields...
  visual,
  object: createWebGLEffectObject({
    sourceKind: options.sourceKind,
    source: options.source,
    target: options.target,
    visual,
  }),
};
```

- [x] **Step 5: Run context verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: pass.

## Task 5: Map Existing Source Capabilities Under `ctx.object`

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectObjectCapabilities.ts`
- Create: `packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObjectContext.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectObject.ts`

- [x] **Step 1: Write capability mapping tests**

Create tests for representative source branches:

```ts
import { describe, expect, test } from "vitest";

import { createEffectObjectCapabilities } from "../../../src/lib/effects/effectObjectCapabilities";
import type { WebGLEffectSourceHandle } from "../../../src/lib/effects/effectAuthoring";

describe("createEffectObjectCapabilities", () => {
  test("maps dom text to object.text", () => {
    const source = {
      kind: "dom",
      type: "text",
      element: document.createElement("p"),
      text: "Hello",
      textLayer: {
        text: "Hello",
        style: {
          font: "16px sans-serif",
          lineHeight: 16,
          letterSpacing: 0,
          wordSpacing: 0,
          textAlign: "left",
          color: "#fff",
        },
        shaderInputs: {
          size: { width: 1, height: 1, devicePixelRatio: 1 },
          contentBox: { x: 0, y: 0, width: 1, height: 1 },
          sourceTexture: { available: false, uniform: "source-texture", width: 0, height: 0 },
          text: "Hello",
          style: {
            font: "16px sans-serif",
            lineHeight: 16,
            letterSpacing: 0,
            wordSpacing: 0,
            textAlign: "left",
            color: "#fff",
          },
          glyphs: [],
        },
        canvas: document.createElement("canvas"),
        context: null,
        clear() {},
        draw() {},
        invalidate() {},
        getSize() {
          return { width: 1, height: 1, devicePixelRatio: 1 };
        },
        getGlyphs() {
          return [];
        },
        setText() {},
        setGlyphs() {},
        createMaterialLayer() {
          throw new Error("not needed");
        },
      },
    } satisfies WebGLEffectSourceHandle;

    expect(createEffectObjectCapabilities(source).text?.text).toBe("Hello");
  });
});
```

Keep follow-up tests smaller by using local helpers for image/video/model
handles.

- [x] **Step 2: Run RED verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts
```

Expected: fail because `effectObjectCapabilities.ts` does not exist.

- [x] **Step 3: Implement capability mapping**

`createEffectObjectCapabilities(source)` should return:

- `surface` for `dom/element` when `source.surface` exists;
- `text` for `dom/text` when `source.textLayer` exists;
- `texture` for `media/image`, `media/video`, and `media/image-sequence` when
  the source image/video/image handle exists;
- `video` for `media/video`;
- `model` for `model/glb`.

Model facade mapping:

```ts
model: {
  meshes: {
    all() {
      return source.model.getMeshes();
    },
    forEach(visitor) {
      source.model.forEachMesh(visitor);
    },
  },
  sampling: {
    vertices(options) {
      return source.model.sampleVertices(options);
    },
  },
  points: {
    create(options) {
      return source.model.createPointLayer(options);
    },
  },
}
```

- [x] **Step 4: Merge capabilities into `createWebGLEffectObject(...)`**

In `effectObjectContext.ts`, spread the capabilities into the returned object:

```ts
const capabilities = createEffectObjectCapabilities(options.source);

return {
  // transform and postprocess fields...
  ...capabilities,
};
```

- [x] **Step 5: Run GREEN verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectObjectCapabilities.test.ts packages/dom-webgl-runtime/test/lib/effects/effectObjectContext.test.ts packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: pass.

## Task 6: Migrate Example Effects To Object-First Authoring

**Files:**

- Modify: `apps/example/src/surfaceEffects.ts`
- Modify: `apps/example/src/textEffects.ts`
- Modify: `apps/example/src/mediaEffects.ts`
- Modify: `apps/example/src/modelEffects.ts`
- Modify: `apps/example/test/surfaceEffects.test.ts`
- Modify: `apps/example/test/textEffects.test.ts`
- Modify: `apps/example/test/mediaEffects.test.ts`
- Modify: `apps/example/test/modelEffects.test.ts`

- [x] **Step 1: Convert simple target transforms first**

Replace patterns like:

```ts
ctx.target?.setOpacity(opacity);
ctx.target?.setRotation(0, rotation, 0);
ctx.target?.setScale(scale);
```

with:

```ts
ctx.object.opacity = opacity;
ctx.object.rotation.set(0, rotation, 0);
ctx.object.scale.setScalar(scale);
```

- [x] **Step 2: Convert source capability reads where direct equivalents exist**

Replace:

```ts
ctx.source.textLayer?.setGlyphs(transformGlyphs);
```

with:

```ts
ctx.object.text?.setGlyphs(transformGlyphs);
```

Replace:

```ts
ctx.source.image?.setTextureTransform(transform);
```

with:

```ts
ctx.object.texture?.setTransform(transform);
```

Replace:

```ts
ctx.source.model.createPointLayer(options);
```

with:

```ts
ctx.object.model?.points.create(options);
```

- [x] **Step 3: Keep source narrowing only where declaration compatibility requires it**

For effects that still need source metadata such as text content, frame number,
or media src, keep the existing safe guard:

```ts
if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
  return;
}
```

Do not introduce new source-specific public methods during the migration.

- [x] **Step 4: Run app tests**

Run:

```bash
npm test -- --run apps/example/test/surfaceEffects.test.ts apps/example/test/textEffects.test.ts apps/example/test/mediaEffects.test.ts apps/example/test/modelEffects.test.ts apps/example/test/exampleEffects.test.ts
```

Expected: pass.

## Task 7: Public Boundary Guard Against Source-Specific Expansion

**Files:**

- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/effects/effect-boundary.test.ts`

- [x] **Step 1: Add negative type checks for model-only sprawl**

Add public type fixture checks:

```ts
declare const ctx: WebGLEffectContext;

if (ctx.source.kind === "model" && ctx.source.type === "glb") {
  // @ts-expect-error new public model animation controls belong under ctx.object.
  ctx.source.model.animations;
  // @ts-expect-error new public model light controls belong under ctx.object.
  ctx.source.model.requestLight;
  // @ts-expect-error new public model picking controls belong under ctx.object.
  ctx.source.model.hitTest;
  // @ts-expect-error new public material variants belong under ctx.object.
  ctx.source.model.materialVariants;
}
```

- [x] **Step 2: Add source file boundary test**

In `effect-boundary.test.ts`, assert that public authoring types do not import
`three`:

```ts
expect(effectAuthoringSource).not.toContain("from \"three");
expect(effectObjectSource).not.toContain("from \"three");
expect(effectObjectSource).not.toContain("from 'three");
```

- [x] **Step 3: Run boundary verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts packages/dom-webgl-runtime/test/lib/effects/effect-boundary.test.ts
```

Expected: pass.

## Task 8: Docs Migration To Object-First Authoring

**Files:**

- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/agent/effect-object-boundary.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/custom-effects.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `AGENTS.md`

- [x] **Step 1: Update examples from current-handle syntax to object syntax**

Replace first-path examples like:

```ts
ctx.target?.setOpacity(clampNumber(params.opacity, 0, 1, 1));
```

with:

```ts
ctx.object.opacity = clampNumber(params.opacity, 0, 1, 1);
```

Replace text examples like:

```ts
ctx.source.textLayer?.setGlyphs((glyphs) => glyphs.map(transformGlyph));
```

with:

```ts
ctx.object.text?.setGlyphs((glyphs) => glyphs.map(transformGlyph));
```

- [x] **Step 2: Keep a compatibility note for `ctx.source`**

Use this exact wording in package usage docs:

```md
`ctx.source` remains available for source metadata and compatibility. New visual
control examples should use `ctx.object` first. Do not add new public
source-specific capability families without first designing their object-facade
shape.
```

- [x] **Step 3: Update status docs**

In `README.md` and `docs/EXECUTION_STATE.md`, change the effect object note from
"not implemented yet" to "implemented" only after Tasks 1-7 pass.

- [x] **Step 4: Run docs verification**

Run:

```bash
rg -n "ctx\\.target\\?\\.set|ctx\\.source\\.(surface|textLayer|image|video|model)" README.md docs/00-goal.md docs/agent docs/examples AGENTS.md
git diff --check
```

Expected: remaining matches are compatibility notes, source metadata examples,
or historical entries explicitly labeled as historical/current-truth.

## Task 9: Optional Breaking Cleanup After Object Migration

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Modify: app and docs files touched in Task 8

Completion note: this run keeps `ctx.source`, `ctx.target`, and `ctx.visual` as
compatibility fields and implementation substrate. `ctx.source` is still needed
for source metadata and shader inputs, and docs now teach `ctx.object` first for
new visual control. Because `ctx.target` was not removed, the compile-time
rejection step is intentionally not applicable.

- [x] **Step 1: Decide the public compatibility policy**

Because the package is still workspace-private and not published, prefer the
breaking cleanup if app/example and docs are already migrated:

```ts
type WebGLEffectContext = {
  // keep timing/input/layout/progress/resources
  object: WebGLEffectObjectHandle;
  source: WebGLEffectSourceHandle; // keep only if source metadata still needs public access
  target?: WebGLEffectTargetHandle; // remove if no public examples/tests need it
  visual: WebGLEffectVisualContext; // keep if postprocess is not fully object-routed
};
```

If `target` and `visual` are kept, mark them as compatibility fields in docs and
keep examples object-first.

- [x] **Step 2: Add compile-time rejection for removed direct handles**

If removing `ctx.target`, add:

```ts
// @ts-expect-error use ctx.object transform controls instead.
ctx.target?.setOpacity(1);
```

If keeping it, do not add this rejection.

- [x] **Step 3: Run full verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected: all pass.

## Full Verification Plan

Run before calling the refactor complete:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected:

- all Vitest suites pass;
- typecheck passes;
- build passes;
- import boundary check passes;
- whitespace check passes;
- docs no longer teach source-handle expansion as the forward API direction.

## Recommended First Implementation Loop

1. Task 1: lock the public `ctx.object` contract with failing tests.
2. Task 2: add public facade types.
3. Task 3: implement transform/visibility/opacity facade.
4. Task 4: attach `ctx.object` to the effect context.
5. Task 5: map existing source capabilities under the object facade.
6. Stop and run targeted verification before migrating example code.

Do not start model animation, picking, lights, variants, or enhanced sampling
until this object facade exists and examples use it.

## Self-Review Checklist

- This plan centers public authoring on `ctx.object`.
- It does not expose raw Three.js objects or loader callbacks.
- It treats existing source handles as implementation substrate and compatibility
  surface, not the expansion direction.
- Every new file has one responsibility.
- Every task has tests and explicit verification commands.
- Docs migration happens after behavior exists, not before.
