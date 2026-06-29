# AI-First Public API Boundary Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps are marked complete with checkbox (`- [x]`) syntax.

**Goal:** Tighten the public effect authoring API so AI agents keep using controlled DOM WebGL runtime capabilities instead of inferring raw Three.js object ownership from public type names.

**Architecture:** Keep the current `defineWebGLEffect(...)`, source handles, material layers, and model handles. Remove raw-looking fields from public handle types, keep internal Three.js objects inside runtime adapters, and keep shader authoring Three-inspired but not Three-compatible. This is a breaking public API cleanup with no compatibility shim.

**Tech Stack:** TypeScript, React example app, Three.js internal adapters, Vitest/jsdom, public export type fixtures, docs-as-contract.

**Implementation status:** Completed on `codex/effect-authoring-examples`.
The public boundary tightening landed through `b2f369a` (public type cleanup),
`9410896` (example controlled-handle cleanup), `20f9da7` (docs alignment),
and `21645b0` (final fixture/runtime cleanup). Current public truth:
`WebGLEffectMaterialProgram` exposes only `vertexShader`, `fragmentShader`,
`uniforms`, `defines`, and `blend`; public effect authoring handles do not
expose `object3D`, `mesh`, `material`, `texture`, raw mesh traversal, raw
point-cloud objects, or target-level raw object attachment; controlled
capabilities remain `draw`, `setGlyphs`, `setTextureTransform`,
`createMaterialLayer`, `forEachMesh`, `sampleVertices`, `createPointLayer`,
and target transform/opacity/visibility methods. No compatibility shim was
added.

---

## Starting Truth

- Public effect authoring types live in `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`.
- `WebGLEffectMaterialProgram` currently exposes shader fields plus render-state fields: `transparent`, `depthWrite`, `depthTest`, and `toneMapped`.
- Public handles currently expose raw-looking fields: `object3D`, `mesh`, `material`, and `texture`.
- `WebGLModelEffectHandle` also exposes raw-model escape hatches: `object3D`, `traverseMeshes(visitor: (mesh: unknown) => void)`, and `createPointCloud(...): unknown`.
- The actual app code barely uses those raw escape hatches. The main real app usage to update is `apps/example/src/sequenceCardEffect.ts`, which reads `surface.object3D` / `surface.mesh` for a scene anchor.
- The shader examples in `apps/example/src/mediaEffects.ts` and `apps/example/src/ghostCursorSurface.ts` use render-state fields that should no longer be public.
- Internal runtime code may keep using `object3D`, `mesh`, `material`, `texture`, `transparent`, `depthWrite`, and `depthTest`. The cleanup is only for public effect authoring contracts.

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`: remove raw-looking public handle fields and remove render-state fields from `WebGLEffectMaterialProgram`.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`: keep internal options unchanged, but stop returning raw fields from public source handles.
- Modify `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`: remove public model raw-object escape hatches and keep controlled mesh/point-layer APIs.
- Modify `packages/dom-webgl-runtime/src/publicExports.test.ts`: add negative type fixtures proving raw fields and render-state fields are not public.
- Modify app test helpers in `apps/example/test/effectSourceHandles.ts`, `apps/example/src/modelEffects.test.ts`, and package tests that construct public handles.
- Modify app examples in `apps/example/src/sequenceCardEffect.ts`, `apps/example/src/mediaEffects.ts`, and `apps/example/src/ghostCursorSurface.ts`.
- Modify docs: `README.md`, `docs/agent/package-onboarding.md`, `docs/agent/package-usage.md`, `docs/agent/custom-effects.md`, `docs/examples/effect-authoring.md`, `docs/00-goal.md`, and `docs/EXECUTION_STATE.md`.

## Non-Goals

- Do not add a new effects preset package.
- Do not expose raw Three.js renderer, scene, camera, material, texture, composer, render target, render loop, or pass ordering.
- Do not add a broad `advanced` escape hatch in this iteration.
- Do not change source taxonomy, target declaration shape, or runtime lifecycle behavior.
- Do not rewrite existing example visual effects beyond the minimum API cleanup.

## Target Public API Shape

Keep shader authoring familiar for AI:

```ts
export type WebGLEffectMaterialProgram = {
  vertexShader?: string;
  fragmentShader: string;
  uniforms?: Record<string, WebGLEffectUniformValue>;
  defines?: Record<string, string | number | boolean>;
  blend?: WebGLEffectBlendMode;
};
```

Keep public handles capability-first:

```ts
export type WebGLEffectRenderableHandle = {
  setVisible?(visible: boolean): void;
  setPosition?(x: number, y: number, z?: number): void;
  setRotation?(x: number, y: number, z?: number): void;
  setScale?(x: number, y?: number, z?: number): void;
  setOpacity?(opacity: number): void;
};
```

Source handles expose actions and shader metadata, not raw internals:

```ts
export type WebGLEffectCanvasSurfaceHandle = WebGLEffectRenderableHandle &
  WebGLEffectMaterialLayerHost & {
    readonly canvas: HTMLCanvasElement;
    readonly context: CanvasRenderingContext2D | null;
    readonly shaderInputs: WebGLEffectSurfaceShaderInputs;
    clear(): void;
    draw(drawer: WebGLEffectCanvasDrawer): void;
    invalidate(): void;
    getSize(): { width: number; height: number; devicePixelRatio: number };
  };

export type WebGLEffectTextureLayerHandle<
  TSource extends HTMLImageElement | HTMLVideoElement =
    | HTMLImageElement
    | HTMLVideoElement,
> = WebGLEffectRenderableHandle &
  WebGLEffectMaterialLayerHost & {
    readonly source: TSource;
    readonly shaderInputs: WebGLEffectMediaShaderInputs;
    setTextureTransform(transform: WebGLEffectTextureTransform): void;
    invalidate(): void;
  };
```

Model handles keep controlled mesh/point-layer APIs:

```ts
export type WebGLModelEffectHandle = WebGLEffectRenderableHandle & {
  getMeshes(): readonly WebGLModelMeshHandle[];
  forEachMesh(visitor: (mesh: WebGLModelMeshHandle) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointLayer(
    options: WebGLEffectPointLayerOptions,
  ): WebGLEffectManagedObjectHandle;
};
```

`WebGLEffectTargetHandle` should not expose `addObject3D`. Internal `WebGLEffectTarget` can keep `addObject3D` for runtime-owned implementation plumbing until a future controlled public replacement is designed.

## Tasks

### Task 1: Public Type Fixture Defines The Boundary

**Files:**
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] **Step 1: Add negative material program fixture**

In the existing root entrypoint type-check fixture, replace the current material program fixture that includes render-state fields with this block:

```ts
const publicProgram = {
  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
  uniforms: {
    strength: 0.5,
    enabled: true,
    label: "surface",
    uvScale: [1, 1],
    tint: [1, 1, 1],
    color: [1, 1, 1, 1],
    sourceMap: { kind: "source-texture" },
  },
  defines: { USE_SOURCE: true },
  blend: "screen",
} satisfies WebGLEffectMaterialProgram;

const rawRenderStateProgram = {
  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
  transparent: true,
  depthWrite: false,
  depthTest: true,
  toneMapped: false,
};
// @ts-expect-error material programs do not expose Three.js render-state fields.
rawRenderStateProgram satisfies WebGLEffectMaterialProgram;
```

Use `publicProgram` in the `createMaterialLayer(...)` fixture so the positive path still proves shader authoring works.

- [x] **Step 2: Add negative raw handle access fixtures**

Inside the existing `sourceCapabilityEffect` update fixture, add these checks in the corresponding source branches:

```ts
if (ctx.source.kind === "dom" && ctx.source.type === "element") {
  // @ts-expect-error surface texture is runtime-owned and not public.
  ctx.source.surface?.texture;
  // @ts-expect-error surface mesh is runtime-owned and not public.
  ctx.source.surface?.mesh;
  // @ts-expect-error surface material is runtime-owned and not public.
  ctx.source.surface?.material;
}

if (ctx.source.kind === "media" && ctx.source.type === "image") {
  // @ts-expect-error media texture is runtime-owned and not public.
  ctx.source.image?.texture;
  // @ts-expect-error media mesh is runtime-owned and not public.
  ctx.source.image?.mesh;
  // @ts-expect-error media material is runtime-owned and not public.
  ctx.source.image?.material;
}

if (ctx.source.kind === "model" && ctx.source.type === "glb") {
  // @ts-expect-error model root object is runtime-owned and not public.
  ctx.source.model.object3D;
  // @ts-expect-error raw mesh traversal is not public.
  ctx.source.model.traverseMeshes(() => {});
  // @ts-expect-error point-cloud objects are not returned as raw objects.
  ctx.source.model.createPointCloud({ density: 1 });
}

// @ts-expect-error effect targets do not accept raw Object3D children.
ctx.target?.addObject3D?.({}, {});
```

- [x] **Step 3: Run the public export fixture and confirm it fails before implementation**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected before implementation: FAIL with unused `@ts-expect-error` diagnostics for the fields that still exist.

- [x] **Step 4: Keep the failing fixture uncommitted**

Do not commit the red state. Leave the fixture changes in the working tree and continue to Task 2. Task 2 commits the fixture together with the public type cleanup after the test passes.

### Task 2: Tighten Public Effect Authoring Types

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] **Step 1: Replace `WebGLEffectMaterialProgram`**

In `effectAuthoring.ts`, replace the type with:

```ts
export type WebGLEffectMaterialProgram = {
  vertexShader?: string;
  fragmentShader: string;
  uniforms?: Record<string, WebGLEffectUniformValue>;
  defines?: Record<string, string | number | boolean>;
  blend?: WebGLEffectBlendMode;
};
```

- [x] **Step 2: Replace `WebGLEffectRenderableHandle`**

Replace:

```ts
export type WebGLEffectRenderableHandle = {
  readonly object3D: unknown;
  setVisible?(visible: boolean): void;
  setPosition?(x: number, y: number, z?: number): void;
  setRotation?(x: number, y: number, z?: number): void;
  setScale?(x: number, y?: number, z?: number): void;
  setOpacity?(opacity: number): void;
};
```

with:

```ts
export type WebGLEffectRenderableHandle = {
  setVisible?(visible: boolean): void;
  setPosition?(x: number, y: number, z?: number): void;
  setRotation?(x: number, y: number, z?: number): void;
  setScale?(x: number, y?: number, z?: number): void;
  setOpacity?(opacity: number): void;
};
```

- [x] **Step 3: Remove raw fields from source handles**

Replace the surface handle body with:

```ts
export type WebGLEffectCanvasSurfaceHandle = WebGLEffectRenderableHandle &
  WebGLEffectMaterialLayerHost & {
    readonly canvas: HTMLCanvasElement;
    readonly context: CanvasRenderingContext2D | null;
    readonly shaderInputs: WebGLEffectSurfaceShaderInputs;
    clear(): void;
    draw(drawer: WebGLEffectCanvasDrawer): void;
    invalidate(): void;
    getSize(): { width: number; height: number; devicePixelRatio: number };
  };
```

Replace the texture layer handle body with:

```ts
export type WebGLEffectTextureLayerHandle<
  TSource extends HTMLImageElement | HTMLVideoElement =
    | HTMLImageElement
    | HTMLVideoElement,
> = WebGLEffectRenderableHandle &
  WebGLEffectMaterialLayerHost & {
    readonly source: TSource;
    readonly shaderInputs: WebGLEffectMediaShaderInputs;
    setTextureTransform(transform: WebGLEffectTextureTransform): void;
    invalidate(): void;
  };
```

- [x] **Step 4: Remove public `addObject3D` from `WebGLEffectTargetHandle`**

Replace:

```ts
export type WebGLEffectTargetHandle = {
  setVisible(visible: boolean): void;
  setPosition(x: number, y: number, z?: number): void;
  setRotation(x: number, y: number, z?: number): void;
  setScale(x: number, y?: number, z?: number): void;
  setOpacity(opacity: number): void;
  addObject3D?(
    object3D: unknown,
    options?: { dispose?: (object3D: unknown) => void },
  ): WebGLEffectManagedObjectHandle;
};
```

with:

```ts
export type WebGLEffectTargetHandle = {
  setVisible(visible: boolean): void;
  setPosition(x: number, y: number, z?: number): void;
  setRotation(x: number, y: number, z?: number): void;
  setScale(x: number, y?: number, z?: number): void;
  setOpacity(opacity: number): void;
};
```

Do not change `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts` in this task. That type is internal runtime plumbing.

- [x] **Step 5: Remove raw model escape hatches**

Replace:

```ts
export type WebGLModelEffectHandle = WebGLEffectRenderableHandle & {
  readonly object3D: unknown;
  traverseMeshes(visitor: (mesh: unknown) => void): void;
  getMeshes(): readonly WebGLModelMeshHandle[];
  forEachMesh(visitor: (mesh: WebGLModelMeshHandle) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointCloud(options: {
    density?: number;
    color?: number | string;
    size?: number;
  }): unknown;
  createPointLayer(
    options: WebGLEffectPointLayerOptions,
  ): WebGLEffectManagedObjectHandle;
};
```

with:

```ts
export type WebGLModelEffectHandle = WebGLEffectRenderableHandle & {
  getMeshes(): readonly WebGLModelMeshHandle[];
  forEachMesh(visitor: (mesh: WebGLModelMeshHandle) => void): void;
  sampleVertices(options?: { maxPoints?: number }): Float32Array;
  createPointLayer(
    options: WebGLEffectPointLayerOptions,
  ): WebGLEffectManagedObjectHandle;
};
```

- [x] **Step 6: Run type fixture**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected after this task: Type fixture compiles past the new public API assertions. Runtime tests may still fail until implementation helpers and examples are updated.

- [x] **Step 7: Commit public type cleanup**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "refactor: tighten effect authoring public types"
```

### Task 3: Keep Internal Adapters Working Without Returning Raw Fields

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts`

- [x] **Step 1: Stop returning raw surface fields**

In `createCanvasSurfaceCapabilityHandle`, remove these returned properties:

```ts
texture: options.texture,
mesh: options.mesh,
material: options.material,
```

Keep all existing internal uses of `options.texture`, `options.mesh`, and `options.material` inside methods such as `shaderInputs`, `createMaterialLayer`, `draw`, `clear`, and `invalidate`.

- [x] **Step 2: Stop returning raw media fields**

In `createTextureLayerCapabilityHandle`, remove these returned properties:

```ts
texture: options.texture,
mesh: options.mesh,
material: options.material,
```

Keep `source`, `shaderInputs`, `createMaterialLayer`, `setTextureTransform`, and `invalidate`.

- [x] **Step 3: Remove model raw escape hatches from implementation**

In `createModelEffectHandle`, remove the `traverseMeshes` and `createPointCloud` members. The returned object should keep this shape:

```ts
return {
  ...createObject3DControls(object3D, {
    scaleZ: "x",
    opacity: { kind: "object" },
  }),
  getMeshes() {
    return collectMeshHandles(object3D);
  },
  forEachMesh(visitor) {
    for (const mesh of collectMeshHandles(object3D)) {
      visitor(mesh);
    }
  },
  sampleVertices(options = {}) {
    return sampleModelVertices(object3D, options.maxPoints ?? 2048);
  },
  createPointLayer(options) {
    return createPointLayer(object3D, options);
  },
};
```

In `createModelMeshHandle`, remove this returned property:

```ts
object3D: mesh,
```

Remove the `createPointCloud` code path. Keep `BufferGeometry`, `BufferAttribute`, `PointsMaterial`, and `Points` imports because `createPointLayer(...)` still needs them.

- [x] **Step 4: Keep material layer internal defaults**

In `materialLayer.ts`, replace the render-state reads from public program fields:

```ts
transparent: program.transparent ?? fallbackProgram.transparent ?? true,
depthWrite: program.depthWrite ?? fallbackProgram.depthWrite ?? true,
depthTest: program.depthTest ?? fallbackProgram.depthTest ?? true,
toneMapped: program.toneMapped ?? fallbackProgram.toneMapped ?? true,
```

with runtime-owned defaults:

```ts
transparent: true,
depthWrite: true,
depthTest: true,
toneMapped: true,
```

Keep `blend`, `vertexShader`, `fragmentShader`, `uniforms`, and `defines` compilation unchanged.

- [x] **Step 5: Update source handle tests**

In `sourceCapabilityHandles.test.ts`, keep tests that inspect internal test doubles such as `mesh.material`, but remove any assertions that require returned public handles to have `.texture`, `.mesh`, or `.material`.

Add this assertion to the first surface handle test:

```ts
expect("texture" in handle).toBe(false);
expect("mesh" in handle).toBe(false);
expect("material" in handle).toBe(false);
```

Add this assertion to the media texture handle test:

```ts
expect("texture" in handle).toBe(false);
expect("mesh" in handle).toBe(false);
expect("material" in handle).toBe(false);
```

- [x] **Step 6: Update model handle tests**

Replace the existing `createPointCloud` test with a `sampleVertices` plus `createPointLayer` test:

```ts
test("samples vertices and creates managed point layers without exposing raw points", () => {
  const root = new Group();
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([1, 2, 3]), 3),
  );
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.position.set(10, 20, 30);
  root.add(mesh);

  const handle = createModelEffectHandle(root);
  const positions = handle.sampleVertices({ maxPoints: 1 });
  const layer = handle.createPointLayer({
    positions,
    color: "#7dd3fc",
    size: 0.04,
  });

  expect(Array.from(positions)).toEqual([11, 22, 33]);
  expect(root.children[1]).toBeInstanceOf(Points);
  layer.dispose();
  expect(root.children).toHaveLength(1);
});
```

Add this assertion to the controlled mesh handle test:

```ts
expect("object3D" in (meshHandle ?? {})).toBe(false);
```

- [x] **Step 7: Update material layer tests**

In `materialLayer.test.ts`, remove render-state fields from the public `program` test input:

```ts
program: {
  fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
  uniforms: {
    amount: 0.25,
    enabled: true,
    uvScale: [1, 2],
    color: [1, 0.5, 0.25],
    tint: [1, 1, 1, 0.75],
    sourceMap: { kind: "source-texture" },
  },
  defines: { USE_SOURCE: true },
  blend: "additive",
},
```

Keep assertions proving runtime defaults are internal:

```ts
expect(shader.transparent).toBe(true);
expect(shader.depthWrite).toBe(true);
expect(shader.depthTest).toBe(true);
expect(shader.toneMapped).toBe(true);
```

- [x] **Step 8: Run focused runtime tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit internal adapter cleanup**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts
git commit -m "refactor: hide runtime internals from effect handles"
```

### Task 4: Update Example Code To The Controlled Contract

**Files:**
- Modify: `apps/example/src/sequenceCardEffect.ts`
- Modify: `apps/example/src/mediaEffects.ts`
- Modify: `apps/example/src/ghostCursorSurface.ts`
- Modify: `apps/example/test/effectSourceHandles.ts`
- Modify: `apps/example/src/modelEffects.test.ts`
- Modify: related example tests that instantiate partial public handles

- [x] **Step 1: Remove raw surface anchor reads**

In `sequenceCardEffect.ts`, replace:

```ts
const surface = ctx.source.surface;
const anchor = readSurfaceSceneAnchor(surface, ctx.layout);
```

with:

```ts
const surface = ctx.source.surface;
const anchor = readSceneAnchor(ctx.layout);
```

Replace `readSurfaceSceneAnchor(...)`, `readFiniteNumber(...)`, and `readScenePosition(...)` with:

```ts
function readSceneAnchor(layout: Parameters<typeof exampleSequenceCardEffect.update>[0]["layout"]): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: readSceneX(layout),
    y: readSceneY(layout),
    z: 0,
  };
}
```

Keep `readSceneX(...)` and `readSceneY(...)`.

- [x] **Step 2: Remove render-state fields from image hover reveal**

In `mediaEffects.ts`, replace the material program block:

```ts
program: {
  fragmentShader: imageHoverRevealFragmentShader,
  uniforms: {
    uRevealTexture: {
      kind: "canvas-texture",
      source: readImageHoverRevealPlaceholder(state),
    },
    uMaskTexture: {
      kind: "canvas-texture",
      source: maskCanvas,
    },
    uPointer: [ctx.layout.width * 0.5, ctx.layout.height * 0.5],
    uPointerActive: false,
    uRevealReady: false,
    uRadius: clampNumber(params.radius, 8, 360, 120),
    uFeather: clampNumber(params.feather, 1, 160, 36),
    uRoughness: readImageHoverRevealRoughness(params),
    uTargetSize: [ctx.layout.width, ctx.layout.height],
    uTrailOpacity: readImageHoverRevealTrailOpacity(ctx.time, state, params),
    uUvRepeat: [uvTransform.repeatX, uvTransform.repeatY],
    uUvOffset: [uvTransform.offsetX, uvTransform.offsetY],
  },
},
```

Do not add replacement fields for `transparent`, `depthWrite`, `depthTest`, or `toneMapped`; runtime defaults own those decisions.

- [x] **Step 3: Remove render-state fields from Ghost Cursor**

In `ghostCursorSurface.ts`, replace:

```ts
return {
  defines: { MAX_TRAIL_LENGTH: ghostCursorTrailLength },
  fragmentShader: ghostCursorFragmentShader,
  uniforms: createGhostCursorUniforms(options),
  transparent: true,
  depthWrite: false,
  blend: "screen",
};
```

with:

```ts
return {
  defines: { MAX_TRAIL_LENGTH: ghostCursorTrailLength },
  fragmentShader: ghostCursorFragmentShader,
  uniforms: createGhostCursorUniforms(options),
  blend: "screen",
};
```

- [x] **Step 4: Update example source-handle test fixtures**

In `apps/example/test/effectSourceHandles.ts`, remove raw fields from helper return objects:

```ts
object3D: {},
texture: {},
mesh: {},
material: {},
traverseMeshes: vi.fn(),
createPointCloud: vi.fn(() => ({})),
```

Keep controlled members:

```ts
createMaterialLayer: vi.fn(() => ({
  setProgram: vi.fn(),
  setUniforms: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
})),
setTextureTransform: vi.fn(),
invalidate: vi.fn(),
getMeshes: vi.fn(() => []),
forEachMesh: vi.fn(),
sampleVertices: vi.fn(() => new Float32Array()),
createPointLayer: vi.fn(() => ({
  setVisible: vi.fn(),
  remove: vi.fn(),
  dispose: vi.fn(),
})),
```

- [x] **Step 5: Update model effect tests**

In `apps/example/src/modelEffects.test.ts`, remove `traverseMeshes` and `createPointCloud` from model handle fixtures. Keep `sampleVertices`, `getMeshes`, `forEachMesh`, and `createPointLayer`.

- [x] **Step 6: Run example tests**

Run:

```bash
npm test -- --run apps/example/src/sequenceCardEffect.test.ts apps/example/src/mediaEffects.test.ts apps/example/src/ghostCursorSurface.test.ts apps/example/src/modelEffects.test.ts apps/example/src/exampleEffects.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit example cleanup**

```bash
git add apps/example/src/sequenceCardEffect.ts apps/example/src/mediaEffects.ts apps/example/src/ghostCursorSurface.ts apps/example/test/effectSourceHandles.ts apps/example/src/modelEffects.test.ts apps/example/src/sequenceCardEffect.test.ts apps/example/src/mediaEffects.test.ts apps/example/src/ghostCursorSurface.test.ts apps/example/src/exampleEffects.test.ts
git commit -m "refactor: align example effects with controlled handles"
```

### Task 5: Align Docs With The AI-First Boundary

**Files:**
- Modify: `README.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/custom-effects.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Update README model example**

Replace any example that uses `context.source.model.object3D`, `createPointCloud(...)`, or `ctx.target.addObject3D(...)` with this controlled version:

```ts
const modelParticleEffect = defineWebGLEffect<{
  kind: "app.modelParticles";
}>({
  kind: "app.modelParticles",
  source: "model/glb",
  setup(ctx) {
    if (ctx.source.kind !== "model" || ctx.source.type !== "glb") {
      return undefined;
    }

    const points = ctx.source.model.createPointLayer({
      positions: ctx.source.model.sampleVertices({ maxPoints: 2048 }),
      color: "#7dd3fc",
      size: 0.026,
    });

    return { points };
  },
  update(ctx) {
    if (ctx.source.kind !== "model" || ctx.source.type !== "glb") {
      return;
    }

    ctx.source.model.setRotation?.(0, ctx.time / 1600, 0);
  },
  dispose(_ctx, state) {
    state?.points.dispose();
  },
});
```

- [x] **Step 2: Update package usage source handle table**

In `docs/agent/package-usage.md`, replace:

```md
| `dom/element` | `ctx.source.surface` | canvas draw, clear, invalidate, shader inputs, `createMaterialLayer(...)`, object/material controls |
| `model/glb` | `ctx.source.model` | object controls, controlled mesh handles, material restore, vertex samples, managed point layers |
```

with:

```md
| `dom/element` | `ctx.source.surface` | canvas draw, clear, invalidate, shader inputs, `createMaterialLayer(...)`, visibility/transform/opacity controls |
| `model/glb` | `ctx.source.model` | visibility/transform/opacity controls, controlled mesh handles, material restore, vertex samples, managed point layers |
```

- [x] **Step 3: Replace model capability bullets**

In `docs/agent/package-usage.md`, replace the model section with:

```md
Model source handles expose controlled model capabilities:

- `model.getMeshes()` and `model.forEachMesh(...)` expose controlled mesh handles.
- Mesh handles expose `index`, optional `name`, optional `materialName`, `createMaterialLayer(...)`, and `restoreMaterial()`.
- `model.sampleVertices({ maxPoints })` returns root-local vertex positions for app-authored particle or point-layer effects.
- `model.createPointLayer({ positions, color, size, material })` returns a managed handle whose generated geometry/material lifecycle is runtime-owned.
- Effects do not receive `model.object3D`, raw mesh traversal, or raw point-cloud objects.
```

- [x] **Step 4: Remove public `addObject3D` docs**

Delete the `When adding object3D content:` section from `docs/agent/package-usage.md`. Replace it with:

```md
When an effect needs model particles or generated model-local points, prefer
`ctx.source.model.createPointLayer(...)`. The runtime owns attachment,
ordering, and disposal through the returned managed handle. A future advanced
object attachment API must be designed separately instead of using raw Three.js
objects in the default public contract.
```

- [x] **Step 5: Update material program docs**

Where docs mention material programs or shader layers, state the public program shape:

```md
Material programs are Three-inspired shader declarations, not raw Three.js
materials. Public fields are `vertexShader`, `fragmentShader`, `uniforms`,
`defines`, and `blend`. Runtime-owned defaults decide transparency, depth, tone
mapping, render order, material restoration, texture allocation, and disposal.
```

- [x] **Step 6: Update onboarding and custom-effects docs**

In `docs/agent/package-onboarding.md` and `docs/agent/custom-effects.md`, keep the rule that effects do not receive raw Three objects. Add this sentence:

```md
Public handles are capability handles: use methods such as `draw`, `setGlyphs`,
`setTextureTransform`, `createMaterialLayer`, `forEachMesh`,
`sampleVertices`, and `createPointLayer`; do not rely on `object3D`, `mesh`,
`material`, or `texture` fields.
```

- [x] **Step 7: Update goal and execution state**

In `docs/00-goal.md` and `docs/EXECUTION_STATE.md`, record that the active public contract is AI-first controlled handles. Remove claims that public handles expose raw model objects or point-cloud objects. Keep internal runtime docs that mention scene objects and materials when they describe implementation, not consumer API.

- [x] **Step 8: Run docs drift checks**

Run:

```bash
rg -n "model\\.object3D|traverseMeshes|createPointCloud|addObject3D|transparent: true|depthWrite: false|depthTest: true|toneMapped:" README.md docs/agent docs/examples docs/00-goal.md docs/EXECUTION_STATE.md apps/example/src packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: no matches in public docs, example source, or public export fixtures. Matches in historical `docs/superpowers/plans/*` are allowed and do not need editing.

- [x] **Step 9: Commit docs alignment**

```bash
git add README.md docs/agent/package-onboarding.md docs/agent/package-usage.md docs/agent/custom-effects.md docs/examples/effect-authoring.md docs/00-goal.md docs/EXECUTION_STATE.md
git commit -m "docs: align effect API boundary with controlled handles"
```

### Task 6: Full Verification And Boundary Sweep

**Files:**
- Verify only unless a command exposes a drift.

- [x] **Step 1: Run focused test suite**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sourceCapabilityHandles.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/modelEffectHandle.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/materialLayer.test.ts apps/example/src/sequenceCardEffect.test.ts apps/example/src/mediaEffects.test.ts apps/example/src/ghostCursorSurface.test.ts apps/example/src/modelEffects.test.ts apps/example/src/exampleEffects.test.ts
```

Expected: PASS.

- [x] **Step 2: Run standard package verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected: all commands pass. `npm run check:imports` prints `Example import boundary OK`.

- [x] **Step 3: Run public raw-field search**

Run:

```bash
rg -n "ctx\\.source\\.[a-zA-Z]+\\?\\.(texture|mesh|material)|ctx\\.source\\.model\\.(object3D|traverseMeshes|createPointCloud)|ctx\\.target\\?\\.addObject3D|transparent: true|depthWrite: false|depthTest: true|toneMapped:" apps/example/src packages/dom-webgl-runtime/src/publicExports.test.ts README.md docs/agent docs/examples docs/00-goal.md docs/EXECUTION_STATE.md
```

Expected: no matches. If matches appear in implementation internals outside this command's paths, leave them alone unless they are public API or consumer docs.

- [x] **Step 4: Check worktree scope**

Run:

```bash
git status --short
```

Expected: only files changed by this plan are staged or unstaged. Do not stage unrelated `.tmp/` files if present.

- [x] **Step 5: Final commit**

If Task 1-5 commits were already created, create no extra commit unless verification fixes changed files. If fixes changed files, run:

```bash
git add packages apps README.md docs
git commit -m "fix: complete effect API boundary tightening"
```

Expected: commit succeeds and `git status --short` shows no tracked changes from this plan.

## Rollback Notes

- If shader examples fail visually after render-state fields are removed, adjust internal defaults in `materialLayer.ts`, not public program fields.
- If `sequenceCardEffect` positioning shifts, use `ctx.layout` projection in app code or introduce a public `ctx.target` position reader only after a separate design review. Do not re-expose `object3D` or `mesh`.
- If a real downstream effect needs arbitrary Object3D attachment, capture it as a new advanced API proposal. Do not restore `ctx.target.addObject3D` in the default handle.

## Self-Review

- Spec coverage: covers both requested optimization points, material-program render-state cleanup and raw-looking public handle cleanup.
- Placeholder scan: no task depends on unspecified code or open-ended follow-up work.
- Type consistency: public types use the same names across tests, implementation, example fixtures, and docs.
- Scope check: this plan avoids new visual features and keeps implementation limited to public contract cleanup.
