# DOM Tree Source Layer Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every runtime-owned WebGL target layer derived from `dom/*`, `media/*`, and `model/glb` render according to DOM ancestry and sibling order without requiring consumers to opt into `renderRole: "overlay"` for ordinary nested targets.

**Architecture:** DOM remains the semantic layer tree and layout anchor. Runtime computes one DOM-derived target layer record per registered target, applies a stable target-level ordering to every renderable root, and normalizes flat layer render state so Three.js queueing cannot override DOM order. Effects remain responsible for pixels; the runtime only guarantees placement, lifecycle, and target-level ordering.

**Tech Stack:** TypeScript, Three.js, React adapter, Vitest/jsdom, Vite example app.

---

## Non-Negotiable Semantics

- DOM tree is the only default target-layer authoring model.
- `renderRole` stays a local render policy hint or advanced escape hatch; it must not be required for a normal nested child to appear above its DOM parent.
- DOM `left/top/width/height` are positioning inputs only. The visual output of `dom/element` comes from `ctx.source.surface.draw(...)`; the runtime must not clone CSS backgrounds/borders/shadows to solve this.
- Flat target layers (`dom/element`, `dom/text`, `media/image`, `media/video`, `media/image-sequence`) must share a render queue strategy that lets DOM order win.
- `model/glb` must receive the same DOM-derived target root ordering. Model internals keep local 3D depth; target-level overlap with other targets should be tested through root ordering and depth isolation behavior.

## Current Code Facts To Respect

- `packages/dom-webgl-runtime/src/lib/dom/targetTree.ts` already derives `parentKey`, `depth`, `siblingIndex`, and `paintIndex` from real DOM ancestry and sibling order.
- `packages/dom-webgl-runtime/src/lib/render/layerOrdering.ts` maps `paintIndex + renderRole` to `renderOrder`, `transparent`, `depthWrite`, and `depthTest`.
- `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts` currently treats `surface` as `opacityMode: "opaque"`, which lets Three.js draw it in the opaque queue before transparent media, even when DOM order says it should be on top.
- Current uncommitted work already contains parts of the intended fix: recursive ordering application, `depthTest`, element surface `Group -> Mesh`, and opacity controls that stop resetting `transparent` to `false`. Do not assume all of it is final; validate each piece with tests.

## File Map

- Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts`
  - Owns role-to-policy defaults. Flat target roles must not split across Three opaque/transparent queues when DOM order needs to win.
- Modify: `packages/dom-webgl-runtime/src/lib/render/layerOrdering.ts`
  - Owns DOM-derived scoped ordering. It should encode target-layer order and flat/model depth policy, not app/example-specific behavior.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`
  - Owns applying ordering to Object3D roots and descendants.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`
  - `dom/element` surface root should be a stable target root object.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts`
  - `dom/text` should use the same target root shape as other flat layer planes.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
  - `media/image`, `media/video`, and `media/image-sequence` already use `Group -> Mesh`; keep and verify it.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneRenderable.ts` and/or `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
  - Ensure `model/glb` has a target root that receives DOM-derived ordering without breaking model fit.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/object3DControls.ts`
  - Effect opacity changes must not erase ordering-derived `transparent`.
- Modify tests:
  - `packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`
  - `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts`
  - `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
  - `apps/example/src/App.test.tsx`
  - `apps/example/src/sequenceCardEffect.test.ts`
- Modify example:
  - `apps/example/src/App.tsx`
  - `apps/example/src/sequenceCardEffect.ts`
- Modify docs after behavior is verified:
  - `README.md`
  - `docs/00-goal.md`
  - `docs/agent/package-usage.md`
  - `docs/examples/effect-authoring.md`

---

### Task 1: Classify The Dirty Worktree Before Editing Runtime

**Files:**
- Inspect only first: all currently modified files from `git status --short`.

- [ ] **Step 1: Capture the current dirty file list**

Run:

```bash
git status --short
```

Expected: list modified files. Do not reset or checkout files wholesale.

- [ ] **Step 2: Inspect behavior-relevant diffs**

Run:

```bash
git diff -- packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts \
  packages/dom-webgl-runtime/src/lib/render/layerOrdering.ts \
  packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneRenderable.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/object3DControls.ts
```

Expected: identify each change as one of:

- Keep: required for DOM tree ordering.
- Rewrite: useful direction but needs tests or better shape.
- Drop: temporary probe, example-only workaround, timeout-only change, or incomplete experiment.

- [ ] **Step 3: Verify no debug probes remain**

Run:

```bash
rg -n "probe|data-sequence-card|sequence-card-probe|255, 0, 0|renderOrder\\s*=\\s*999|console\\.log|debugger" \
  apps packages
```

Expected: no matches except legitimate test names or debug panel source. Remove any diagnostic leftovers with a focused patch.

---

### Task 2: Write RED Tests For DOM-Tree Ordering Across Source Kinds

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Add a source matrix helper**

Add helper declarations near existing runtime pipeline helpers:

```ts
type LayerSourceCase = {
  name: string;
  key: string;
  element: HTMLElement;
  declaration: Parameters<RuntimeWithPipelineSurface["registerTarget"]>[1];
};

function createLayerSourceCases(): LayerSourceCase[] {
  const domElement = document.createElement("section");
  const domText = document.createElement("p");
  const image = document.createElement("img");
  const video = document.createElement("video");
  const sequence = document.createElement("section");
  const model = document.createElement("section");

  domText.textContent = "Layer text";
  image.src = "/example/image.png";
  video.src = "/example/video.mp4";

  Object.defineProperty(image, "decode", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(video, "pause", {
    configurable: true,
    value: vi.fn(),
  });

  return [
    {
      name: "dom element",
      key: "case.dom.element",
      element: domElement,
      declaration: { key: "case.dom.element", source: { kind: "dom", type: "element" } },
    },
    {
      name: "dom text",
      key: "case.dom.text",
      element: domText,
      declaration: { key: "case.dom.text", source: { kind: "dom", type: "text" } },
    },
    {
      name: "media image",
      key: "case.media.image",
      element: image,
      declaration: {
        key: "case.media.image",
        source: { kind: "media", type: "image", src: "/example/image.png" },
      },
    },
    {
      name: "media video",
      key: "case.media.video",
      element: video,
      declaration: {
        key: "case.media.video",
        source: { kind: "media", type: "video", src: "/example/video.mp4" },
      },
    },
    {
      name: "media image sequence",
      key: "case.media.sequence",
      element: sequence,
      declaration: {
        key: "case.media.sequence",
        source: {
          kind: "media",
          type: "image-sequence",
          frameCount: 1,
          frames: [document.createElement("canvas")],
        },
      },
    },
    {
      name: "model glb",
      key: "case.model.glb",
      element: model,
      declaration: {
        key: "case.model.glb",
        source: { kind: "model", type: "glb", src: "/models/hero.glb" },
      },
    },
  ];
}
```

- [ ] **Step 2: Add a matrix test that nests every source as a child of media**

Add a test that proves no child needs `renderRole: "overlay"`:

```ts
test.each(createLayerSourceCases())(
  "orders nested %s target above parent media without renderRole override",
  async ({ key, element, declaration }) => {
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const parent = document.createElement("section");
    parent.append(element);
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: () => createLayoutMeasurement(0, 0, 240, 160),
      loadVideo: async (source) => source.element ?? document.createElement("video"),
      loadModel: async () => createModelObject3DStub(),
    });

    runtime.registerTarget(parent, {
      key: "parent.sequence",
      source: {
        kind: "media",
        type: "image-sequence",
        frameCount: 1,
        frames: [document.createElement("canvas")],
      },
    });
    runtime.registerTarget(element, declaration);

    await runtime.sync();

    const parentObject = readSceneObject(sceneAdapter, "parent.sequence");
    const childObject = readSceneObject(sceneAdapter, key);

    expect(childObject.ordering?.renderOrder).toBeGreaterThan(
      parentObject.ordering?.renderOrder ?? -1,
    );
    expect(readObject3DRenderOrder(childObject.object3D)).toBe(
      childObject.ordering?.renderOrder,
    );
    expect(readObject3DRenderOrder(parentObject.object3D)).toBe(
      parentObject.ordering?.renderOrder,
    );

    runtime.dispose();
  },
);
```

- [ ] **Step 3: Add helpers used by the matrix test**

Add:

```ts
function readSceneObject(
  sceneAdapter: ReturnType<typeof createObjectRecordingSceneAdapter>,
  key: string,
): WebGLSceneObject {
  const object = sceneAdapter.objects.find((entry) => entry.key === key);

  if (!object) {
    throw new Error(`Missing scene object ${key}`);
  }

  return object;
}

function readObject3DRenderOrder(object3D: unknown): number | undefined {
  if (!object3D || typeof object3D !== "object") {
    return undefined;
  }

  return (object3D as { renderOrder?: number }).renderOrder;
}

function createModelObject3DStub() {
  return {
    scene: {
      isObject3D: true,
      children: [],
      position: { set: vi.fn() },
      scale: { set: vi.fn() },
      traverse(callback: (object: unknown) => void) {
        callback(this);
      },
      clone() {
        return this;
      },
    },
  };
}
```

- [ ] **Step 4: Run the matrix test and confirm RED**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts -t "orders nested"
```

Expected before implementation: at least `dom/element` or `dom/text` fails because queue/root/material state is not uniformly DOM-order-safe without `renderRole: "overlay"`.

---

### Task 3: Normalize Flat Render Policy So DOM Order Can Win

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`

- [ ] **Step 1: Write failing policy expectations**

In `renderPolicy.test.ts`, assert flat policies do not split into opaque/transparent queues:

```ts
test("keeps flat DOM and media roles in the DOM-ordered transparent queue", () => {
  for (const role of ["surface", "content", "media", "overlay"] as const) {
    const ordering = toSceneObjectOrdering(compileRenderPolicy(role));

    expect(ordering.transparent).toBe(true);
    expect(ordering.depthWrite).toBe(false);
    expect(ordering.depthTest).toBe(false);
  }
});

test("keeps model role depth-enabled while still receiving render ordering", () => {
  const ordering = toSceneObjectOrdering(compileRenderPolicy("model"));

  expect(ordering.transparent).toBe(true);
  expect(ordering.depthWrite).toBe(true);
  expect(ordering.depthTest).toBe(true);
});
```

- [ ] **Step 2: Implement minimal policy change**

Update `compileRenderPolicy` so `surface` and `model` do not fall into a queue that can override DOM target order:

```ts
export function compileRenderPolicy(renderRole: WebGLRenderRole): RenderPolicy {
  switch (renderRole) {
    case "surface":
      return {
        role: renderRole,
        band: 0,
        depthMode: "flat",
        opacityMode: "alpha",
      };
    case "content":
      return {
        role: renderRole,
        band: 1,
        depthMode: "flat",
        opacityMode: "alpha",
      };
    case "media":
      return {
        role: renderRole,
        band: 2,
        depthMode: "flat",
        opacityMode: "source",
      };
    case "model":
      return {
        role: renderRole,
        band: 3,
        depthMode: "model",
        opacityMode: "alpha",
      };
    case "overlay":
      return {
        role: renderRole,
        band: 4,
        depthMode: "flat",
        opacityMode: "alpha",
      };
  }
}
```

- [ ] **Step 3: Run focused policy tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts
```

Expected: PASS.

---

### Task 4: Apply Ordering Recursively And Preserve It Through Effects

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/object3DControls.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts`

- [ ] **Step 1: Test recursive ordering application**

Add to `sceneObject.test.ts`:

```ts
test("applies ordering to object3D descendants", () => {
  const childMaterial = {};
  const object = {
    key: "layer",
    object3D: {
      renderOrder: 0,
      children: [
        {
          renderOrder: 0,
          material: childMaterial,
          children: [],
        },
      ],
    },
    setVisible: vi.fn(),
    updateLayout: vi.fn(),
    dispose: vi.fn(),
  };

  applySceneObjectOrdering(object, {
    renderOrder: 320,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  expect((object.object3D as { renderOrder: number }).renderOrder).toBe(320);
  expect(
    (object.object3D.children[0] as { renderOrder: number }).renderOrder,
  ).toBe(320);
  expect(childMaterial).toMatchObject({
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
});
```

- [ ] **Step 2: Implement recursive ordering if missing**

Ensure `applyObject3DOrdering` has this shape:

```ts
function applyObject3DOrdering(
  object3D: unknown,
  ordering: WebGLSceneObjectOrdering,
): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  (object3D as { renderOrder?: number }).renderOrder = ordering.renderOrder;
  applyMaterialOrdering(
    (object3D as { material?: unknown }).material,
    ordering,
  );
  const children = (object3D as { children?: unknown }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      applyObject3DOrdering(child, ordering);
    }
  }
}
```

- [ ] **Step 3: Test opacity does not erase ordering transparency**

Add to the relevant object control test file, or create a focused case near existing object control tests:

```ts
test("setOpacity does not reset material transparent to false at opacity 1", () => {
  const material = { transparent: true, opacity: 0.4 };
  const controls = createObject3DControls(
    {},
    { opacity: { kind: "material", material } },
  );

  controls.setOpacity(1);

  expect(material).toMatchObject({
    opacity: 1,
    transparent: true,
    needsUpdate: true,
  });
});
```

- [ ] **Step 4: Implement opacity preservation**

Ensure `setMaterialOpacity` only enables transparency when needed and never disables an ordering-derived transparent state:

```ts
function setMaterialOpacity(material: unknown, opacity: number): void {
  const materials = Array.isArray(material) ? material : [material];

  for (const entry of materials) {
    if (entry && typeof entry === "object") {
      Object.assign(entry, {
        opacity,
        needsUpdate: true,
      });
      if (opacity < 1) {
        Object.assign(entry, { transparent: true });
      }
    }
  }
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts
```

Expected: PASS.

---

### Task 5: Normalize Renderable Root Shape Across Source Types

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/elementPlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/textPlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/texturePlaneSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelSceneRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts`

- [ ] **Step 1: Add tests for root object shape**

Add or extend tests so every renderable controller returns a root with children for plane-like layers:

```ts
function expectGroupRootWithChild(object3D: unknown): void {
  expect(object3D).toMatchObject({
    children: expect.any(Array),
  });
  expect((object3D as { children: unknown[] }).children.length).toBeGreaterThan(0);
}
```

Use it for:

```ts
expectGroupRootWithChild(elementController.object.object3D);
expectGroupRootWithChild(textController.object.object3D);
expectGroupRootWithChild(textureController.object.object3D);
```

- [ ] **Step 2: Keep or implement `dom/element` as `Group -> Mesh`**

Ensure `createElementPlaneSceneRenderableController` creates a `Group` root and passes the group to the scene controller and effect target:

```ts
const mesh = new Mesh(geometry, material);
const group = new Group();

group.add(mesh);
group.visible = false;

const controller = createSceneRenderableController({
  ...options,
  object3D: group,
  effectTarget: createElementPlaneEffectTarget(
    group,
    material,
    createManagedObject3DFactory(options),
  ),
  disposeResources() {
    texture.dispose();
    geometry.dispose();
    material.dispose();
  },
});
```

- [ ] **Step 3: Change `dom/text` from bare `Mesh` to `Group -> Mesh`**

Update `createTextPlaneSceneRenderableController`:

```ts
import { Group } from "three/src/objects/Group.js";

const mesh = new Mesh(geometry, material);
const group = new Group();
group.add(mesh);

const controller = createSceneRenderableController({
  ...options,
  object3D: group,
  textureSource: canvas,
  disposeResources() {
    texture.dispose();
    geometry.dispose();
    material.dispose();
  },
});
```

Keep `TextLayerCapabilityOptions` pointing at the actual mesh and material:

```ts
const textLayerOptions: TextLayerCapabilityOptions = {
  object3D: group,
  mesh,
  material,
  canvas,
  context,
  texture,
  getSize() {
    return readSurfaceSize(lastMeasurement);
  },
  getText() {
    return textContent;
  },
  getStyle() {
    return textLayerStyle;
  },
  getGlyphs() {
    return glyphs;
  },
  setText(nextText) {
    controller.updateTextContent(nextText);
  },
  setGlyphs(transform) {
    glyphCommandTransform = transform;
    applyGlyphCommandTransform();
  },
  invalidate() {
    texture.needsUpdate = true;
  },
};
```

- [ ] **Step 4: Keep media as `Group -> Mesh` and assert material flags**

Verify `createTexturePlaneSceneRenderableController` keeps:

```ts
const mediaMesh = new Mesh(mediaGeometry, material);
const group = new Group();

group.add(mediaMesh);
```

Add test assertions that ordering applies to both group and `mediaMesh.material`.

- [ ] **Step 5: Wrap model target root without breaking model fit**

If current model renderable passes the loaded GLTF scene directly to `createModelSceneRenderableController`, wrap it:

```ts
import { Group } from "three/src/objects/Group.js";

function createModelTargetRoot(modelScene: unknown): unknown {
  const group = new Group();
  if (modelScene && typeof modelScene === "object") {
    group.add(modelScene as never);
  }
  return group;
}
```

Then pass the group as the renderable object. `createModelSceneRenderableController` can still calculate bounds from the group because Three `Box3().setFromObject(group)` includes descendants.

- [ ] **Step 6: Run source renderable tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
```

Expected: PASS.

---

### Task 6: Remove `renderRole: "overlay"` From The Example Contract

**Files:**
- Modify: `apps/example/src/App.tsx`
- Modify: `apps/example/src/App.test.tsx`
- Modify: `apps/example/src/sequenceCardEffect.ts`
- Modify: `apps/example/src/sequenceCardEffect.test.ts`

- [ ] **Step 1: Update example assertion first**

In `App.test.tsx`, assert the card does not declare `renderRole`:

```ts
expect(cardTarget.webgl).toMatchObject({
  key: "example.image-sequence.card",
  source: { kind: "dom", type: "element" },
});
expect(cardTarget.webgl).not.toHaveProperty("renderRole");
```

- [ ] **Step 2: Remove overlay override from App**

In `apps/example/src/App.tsx`, card declaration should stay semantic:

```tsx
webgl={{
  key: "example.image-sequence.card",
  source: { kind: "dom", type: "element" },
  lifecycle: { hideWhenReady: true, hideMode: "subtree" },
  effects: sequenceCardEffects,
}}
```

- [ ] **Step 3: Keep effect-owned drawing**

In `sequenceCardEffect.ts`, the effect must keep drawing pixels through the element surface:

```ts
ctx.source.surface?.draw((surface) => {
  drawSequenceCardSurface(surface.context, surface.width, surface.height);
});
ctx.source.surface?.setVisible(true);
ctx.source.surface?.setOpacity(1);
ctx.target?.setVisible(true);
ctx.target?.setOpacity(opacity);
```

Do not restore DOM fallback just to make the card visible.

- [ ] **Step 4: Run example tests**

Run:

```bash
npm test -- --run apps/example/src/App.test.tsx apps/example/src/sequenceCardEffect.test.ts
```

Expected: PASS.

---

### Task 7: Prove Runtime Behavior End-To-End

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Strengthen runtime pipeline assertions**

In the nested source matrix test, assert each child target:

```ts
expect(childObject.ordering).toMatchObject({
  transparent: true,
});
expect(childObject.ordering?.renderOrder).toBeGreaterThan(
  parentObject.ordering?.renderOrder ?? -1,
);
```

For flat children, also assert:

```ts
expect(childObject.ordering).toMatchObject({
  depthWrite: false,
  depthTest: false,
});
```

For model children, assert:

```ts
expect(childObject.ordering).toMatchObject({
  depthWrite: true,
  depthTest: true,
});
```

- [ ] **Step 2: Run full targeted runtime suite**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts \
  packages/dom-webgl-runtime/src/lib/renderer/sceneObject.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
```

Expected: PASS.

---

### Task 8: Browser Visual Verification On The Real Example

**Files:**
- No source edit unless verification exposes a real bug.

- [ ] **Step 1: Start the example app**

Run:

```bash
npm run dev -w @project/dom-webgl-example
```

Expected: Vite serves a localhost URL.

- [ ] **Step 2: Navigate to the image-sequence section**

Use the available browser automation tool. Verify:

- DOM fallback for `example.image-sequence.card` is hidden.
- The card is visible on the WebGL canvas.
- The parent image-sequence remains visible.
- Debug state shows `example.image-sequence.card` as a child of `example.image-sequence.scrub`.
- `example.image-sequence.card` has no `renderRole: "overlay"` declaration in app source.

- [ ] **Step 3: Save a screenshot artifact**

Save a screenshot under `/tmp/dom-webgl-card-dom-order.png`.

Expected: visible WebGL-rendered card over the image sequence, not native DOM text.

- [ ] **Step 4: Stop the dev server**

Stop only the dev server started in Step 1.

---

### Task 9: Sync Docs To The New Public Mental Model

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/examples/effect-authoring.md`

- [ ] **Step 1: Replace overlay workaround language**

Search:

```bash
rg -n "renderRole.*overlay|overlay.*nested|nested.*overlay|DOM tree|Nested WebGLTarget" README.md docs
```

Expected: update any wording that implies ordinary nested targets need `renderRole: "overlay"`.

- [ ] **Step 2: Document the invariant**

Add concise wording:

```md
Nested `WebGLTarget` layers are ordered by DOM ancestry and sibling order by default.
`renderRole` selects local source/render policy; it is not required to make a child target
paint above its parent. DOM supplies layout and layer semantics. Effect code supplies pixels.
```

- [ ] **Step 3: Document the `dom/element` surface caveat**

Keep this caveat explicit:

```md
`dom/element` is a transparent layout surface until an effect draws to
`ctx.source.surface`. Runtime does not clone CSS backgrounds, borders, shadows,
or other decorative paint into WebGL.
```

---

### Task 10: Full Verification And Commit

**Files:**
- All files touched above.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected:

- Tests pass.
- Typecheck passes.
- Build passes. Vite chunk-size warning is acceptable if unchanged.
- Import guard passes.
- No whitespace errors.

- [ ] **Step 2: Review final diff for temporary code**

Run:

```bash
git diff --stat
git diff --check
rg -n "probe|data-sequence-card|sequence-card-probe|255, 0, 0|renderOrder\\s*=\\s*999|console\\.log|debugger" \
  apps packages
```

Expected: no temporary diagnostics.

- [ ] **Step 3: Commit**

Run:

```bash
git add apps/example packages/dom-webgl-runtime README.md docs
git commit -m "fix: honor dom tree ordering for source layers"
```

Expected: one commit containing runtime behavior, example dogfood, tests, and docs.

---

## Self-Review Notes

- This plan keeps runtime package behavior generic and does not hardcode `example.image-sequence.card`.
- The example remains a downstream consumer and uses only public API entrypoints.
- The key risk is `model/glb`: target root ordering can be made DOM-derived, but model internals must preserve local 3D depth. Tests should separate target-level DOM ordering from internal model mesh depth.
- The key regression test is removing `renderRole: "overlay"` from the nested example card while keeping the WebGL-rendered card visible.
