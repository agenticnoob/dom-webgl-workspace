# Managed Lit-Material Shader Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Three-like managed `onBeforeCompile` material extension API and use it to make the `hero-next` tetrahedron perform the same reversible screen-space radial two-color diffusion as the background.

**Architecture:** A focused internal `managedMaterialShader` host owns the real Three material hooks, uniform normalization, program cache identity, viewport/DPR uniforms, and cleanup. `managedStageObjects` attaches that host to runtime-owned Basic/Standard/Physical meshes, while the public material facade exposes only `onBeforeCompile`, `setUniforms`, and `remove`. `hero-next` defines one app-owned Standard-material extension that mixes diffuse and emissive inputs before lighting using the existing transition origin and radius.

**Tech Stack:** TypeScript strict mode, Three.js 0.184, Vitest/jsdom, Next.js 16, Playwright/Chromium, npm workspaces.

## Global Constraints

- Work in `/Users/ai/AgentWorkspace/projects/dom-webgl-workspace` on branch `codex/hero-next`, starting from `a2eb98ab807213b4ef6ebbd5f29d8940fc093bff` plus the protected user changes.
- Before implementation, read `superpowers:test-driven-development`; use `superpowers:systematic-debugging` for any unexpected failure; read and use the `playwright` skill for browser QA.
- Use CodeGraph before grep or direct source exploration whenever locating or understanding code.
- Do not expose raw Three Mesh, Material, Shader, renderer, scene, camera, WebGL context, `needsUpdate`, the real callback, or consumer-owned disposal.
- Do not replace Basic/Standard/Physical with an unlit `ShaderMaterial`; preserve lighting, PBR, tone mapping, and color-space processing.
- Package code must be general. It must not contain hero keys, signals, colors, or app-specific branches.
- Hero must keep its Standard material, palette, lights, camera, motion, opacity, timing, scroll runtime, and one-canvas architecture.
- Hero must reuse the existing mesh-hit origin, coverage, radius, state machine, far-corner commit, awaiting-release gate, re-press resume, and bidirectional toggle.
- Mesh and background use the same `1.5px` CSS-pixel feather. Version 1 adds no radial-edge noise.
- Reduced motion keeps color diffusion and disables only shake/fast geometric motion.
- Do not use CSS masks/gradients/filters/opacity, duplicate meshes, postprocess whole-canvas masking, a second renderer/canvas, private package imports, or direct app-owned Three runtime objects.
- Do not modify `docs/archive/`.
- Do not commit, push, stage broadly, or run `git reset`, `git checkout`, or `git restore`. The commit steps normally required by writing-plans are intentionally replaced by unstaged review checkpoints.
- Preserve the existing untracked `.playwright-cli/`, `output/`, and `docs/superpowers/plans/2026-07-16-hero-next-two-tone-tetrahedron-cover.md`.
- Preserve `apps/hero-next/next-env.d.ts` with SHA-256 `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`. After every build-like command, verify the SHA immediately and use only a focused `apply_patch` to restore the task-start content if Next rewrites it.
- Design truth: `docs/superpowers/specs/2026-07-17-managed-lit-material-shader-extension-design.md`.

## File Structure

### Create

- `packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialShader.ts` — internal Three hook composition, managed uniform storage, cache keys, viewport/DPR updates, errors, and disposal.
- `packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialShader.test.ts` — focused unit tests for compilation, uniforms, ordering, cache behavior, viewport inputs, errors, and resources.
- `apps/hero-next/src/heroTetrahedronShader.ts` — app-owned Standard-material shader definition and transition-uniform resolver.
- `apps/hero-next/test/heroTetrahedronShader.test.ts` — shader source and uniform contract tests.

### Modify

- `packages/dom-webgl-runtime/src/lib/effects/effectMaterial.ts` — public shader definition/draft/facade types and `material.shader` field.
- `packages/dom-webgl-runtime/src/index.ts` — root type exports.
- `packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialControls.ts` — expose an injected shader facade without exposing the internal host.
- `packages/dom-webgl-runtime/src/lib/renderer/managedStageObjects.ts` — create one shader host per runtime-owned mesh material, feed renderer viewport data before render, and dispose the host once.
- `packages/dom-webgl-runtime/test/publicExports.test.ts` — public API acceptance and raw-boundary rejection.
- `packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialControls.test.ts` — facade presence/absence and compatibility.
- `packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts` — Basic/Standard/Physical host wiring and exactly-once teardown.
- `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts` — required real `createPipelineRuntime` + default mesh factory + real Three lit-material integration test.
- `apps/hero-next/src/heroHoldTransition.ts` — remove the obsolete whole-material `tetrahedronForeground` decision.
- `apps/hero-next/src/heroEffect.ts` — register the managed callback once, keep base material committed, and update radial uniforms per frame.
- `apps/hero-next/test/heroHoldTransition.test.ts` — committed/target visual semantics without whole-material switching.
- `apps/hero-next/test/heroEffect.test.ts` — RED hard-cut evidence followed by uniform-driven forward/reverse behavior.
- `scripts/external-consumer-fixture.mjs` — tarball-only standard mesh shader dogfood and Chromium mixed-pixel evidence.
- `README.md`, `docs/STATUS.md`, `docs/agent/package-onboarding.md`, `docs/agent/package-usage.md`, `docs/agent/effect-object-boundary.md`, `docs/examples/effect-authoring.md` — active public documentation.
- `apps/hero-next/VISUAL_DESIGN.md` — record the tetrahedron fragment diffusion as implemented visual behavior.
- Generated skill API files changed by `npm run skill:api:generate` — review rather than hand-edit.

---

### Task 1: Freeze the public Three-like material shader surface

**Files:**
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts:650-730,1635-1690,1940-2005`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectMaterial.ts:1-34`
- Modify: `packages/dom-webgl-runtime/src/index.ts:66-70`

**Interfaces:**
- Produces: `WebGLEffectMaterialKind`, `WebGLEffectMaterialShaderDraft`, `WebGLEffectMaterialShaderDefinition`, and `WebGLEffectMaterialShaderFacade`.
- Produces: optional `readonly shader?: WebGLEffectMaterialShaderFacade` on `WebGLEffectMaterialFacade`.
- Consumers: Tasks 2-7.

- [ ] **Step 1: Add a failing public type fixture**

Add the new type imports to the large fixture in `publicExports.test.ts`, then add this usage beside the current `publicCtx.object.material` checks:

```ts
declare const material: WebGLEffectMaterialFacade;

material.shader?.onBeforeCompile({
  key: "app.radial",
  uniforms: {
    radialOrigin: [0.5, 0.5],
    radialRadiusPx: 0,
    targetColor: "#ffffff",
  },
  defines: { APP_RADIAL: true },
  compile(draft) {
    draft.materialKind satisfies WebGLEffectMaterialKind;
    draft.vertexShader = draft.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>",
    );
    draft.fragmentShader = draft.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>",
    );
    draft.uniforms.radialRadiusPx = 12;
    draft.defines.APP_RADIAL = true;
  },
} satisfies WebGLEffectMaterialShaderDefinition);

material.shader?.setUniforms("app.radial", {
  radialOrigin: [0.25, 0.75],
  radialRadiusPx: 320,
});
material.shader?.remove("app.radial");

declare const shaderFacade: WebGLEffectMaterialShaderFacade;
// @ts-expect-error runtime owns shader-extension disposal.
shaderFacade.dispose();
// @ts-expect-error raw Three Material is not exposed.
shaderFacade.material;
material.shader?.onBeforeCompile({
  key: "app.invalid",
  // @ts-expect-error renderer is not passed to the controlled callback.
  compile(_draft, _renderer) {},
});
```

- [ ] **Step 2: Run the public export test and verify RED**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: FAIL because the four new material-shader types and `material.shader` do not exist.

- [ ] **Step 3: Add the public types**

In `effectMaterial.ts`, import `WebGLEffectUniformValue` and add:

```ts
export type WebGLEffectMaterialKind = "basic" | "standard" | "physical";

export type WebGLEffectMaterialShaderDraft = {
  readonly materialKind: WebGLEffectMaterialKind;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, WebGLEffectUniformValue>;
  defines: Record<string, string | number | boolean>;
};

export type WebGLEffectMaterialShaderDefinition = {
  readonly key: string;
  readonly uniforms?: Record<string, WebGLEffectUniformValue>;
  readonly defines?: Record<string, string | number | boolean>;
  compile(draft: WebGLEffectMaterialShaderDraft): void;
};

export type WebGLEffectMaterialShaderFacade = {
  onBeforeCompile(definition: WebGLEffectMaterialShaderDefinition): void;
  setUniforms(
    key: string,
    values: Record<string, WebGLEffectUniformValue>,
  ): void;
  remove(key: string): void;
};
```

Add `readonly shader?: WebGLEffectMaterialShaderFacade` to the existing material facade. Export all four types from `src/index.ts` through the existing `effectMaterial` export block.

- [ ] **Step 4: Run the public type test and package typecheck**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
npm run typecheck -w @viselora/dom-webgl
```

Expected: both PASS. The three `@ts-expect-error` assertions must be consumed.

- [ ] **Step 5: Review checkpoint without staging**

Run:

```bash
git diff --check
git status --short
```

Expected: only the protected pre-existing files, the approved spec/plan, and Task 1 files appear; nothing is staged.

---

### Task 2: Build the managed material shader host core

**Files:**
- Create: `packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialShader.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialShader.ts`

**Interfaces:**
- Consumes: the four public types from Task 1.
- Produces:

```ts
export type ManagedMaterialShaderHost = {
  readonly facade: WebGLEffectMaterialShaderFacade;
  beforeRender(renderer: ManagedMaterialShaderRenderer): void;
  dispose(): void;
};

export type ManagedMaterialShaderRenderer = {
  getSize(target: Vector2): Vector2;
  getPixelRatio(): number;
};

export function createManagedMaterialShaderHost(options: {
  objectId: string;
  materialKind: WebGLEffectMaterialKind;
  material: Material;
}): ManagedMaterialShaderHost;
```

- Consumers: Tasks 3 and 4.

- [ ] **Step 1: Write the missing-host RED tests**

Create `managedMaterialShader.test.ts` with real `MeshStandardMaterial`, `MeshBasicMaterial`, and `MeshPhysicalMaterial`. The first tests must cover:

```ts
test("composes controlled callbacks over a real Standard material", () => {
  const material = new MeshStandardMaterial();
  const host = createManagedMaterialShaderHost({
    objectId: "mesh.hero",
    materialKind: "standard",
    material,
  });
  const compile = vi.fn((draft: WebGLEffectMaterialShaderDraft) => {
    draft.fragmentShader = draft.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\nfloat appMarker = 1.0;",
    );
    draft.uniforms.appAmount = 0.25;
  });

  host.facade.onBeforeCompile({
    key: "app.standard",
    uniforms: { appAmount: 0 },
    compile,
  });
  const shader = createThreeShaderDraft();
  callMaterialCompile(material, shader);

  expect(compile).toHaveBeenCalledTimes(1);
  expect(shader.fragmentShader).toContain("float appMarker = 1.0;");
  expect(shader.uniforms.appAmount?.value).toBe(0.25);
  expect(shader.fragmentShader).toContain("uniform vec2 domWebGLViewportSize;");
  expect(shader.fragmentShader).toContain("uniform float domWebGLPixelRatio;");
});

test("updates live uniforms without changing the program cache key or material version", () => {
  const material = new MeshStandardMaterial();
  const host = createManagedMaterialShaderHost({
    objectId: "mesh.hero",
    materialKind: "standard",
    material,
  });
  host.facade.onBeforeCompile({
    key: "app.standard",
    uniforms: { amount: 0.25, origin: [0.5, 0.5] },
    compile() {},
  });
  const shader = createThreeShaderDraft();
  callMaterialCompile(material, shader);
  const cacheKey = material.customProgramCacheKey();
  const version = material.version;

  host.facade.setUniforms("app.standard", {
    amount: 0.75,
    origin: [0.25, 0.8],
  });

  expect(shader.uniforms.amount?.value).toBe(0.75);
  expect(shader.uniforms.origin?.value).toMatchObject({ x: 0.25, y: 0.8 });
  expect(material.customProgramCacheKey()).toBe(cacheKey);
  expect(material.version).toBe(version);
});

test("adds contextual information when a consumer compile callback throws", () => {
  const material = new MeshStandardMaterial();
  const host = createManagedMaterialShaderHost({
    objectId: "mesh.hero",
    materialKind: "standard",
    material,
  });
  host.facade.onBeforeCompile({
    key: "app.broken",
    compile() {
      throw new Error("broken callback");
    },
  });

  expect(() => callMaterialCompile(material, createThreeShaderDraft())).toThrow(
    'WebGL mesh "mesh.hero" standard material shader extension "app.broken" failed',
  );
});
```

Use `Reflect.apply(material.onBeforeCompile, material, [shader, {}])` in `callMaterialCompile()` so tests do not construct or expose a fake public renderer type. The internal shader fixture contains only `vertexShader`, `fragmentShader`, `uniforms`, and `defines`.

- [ ] **Step 2: Run the new unit test and verify RED**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialShader.test.ts
```

Expected: FAIL because `managedMaterialShader.ts` does not exist.

- [ ] **Step 3: Implement the host's controlled compile path**

Implement a factory, not a class. Internally store ordered entries by key:

```ts
type ShaderExtensionEntry = {
  readonly definition: WebGLEffectMaterialShaderDefinition;
  readonly uniforms: Map<string, ManagedUniformEntry>;
  readonly compiledUniforms: Map<string, Set<ThreeUniform>>;
};

type ThreeUniform = { value: unknown };

type ThreeShaderParameters = {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, ThreeUniform>;
  defines?: Record<string, string | number | boolean>;
};
```

Capture the material's original `onBeforeCompile` and `customProgramCacheKey`. The managed callback must:

1. invoke the original callback with the real material as `this`;
2. apply registered definitions in insertion order;
3. create a controlled draft containing only public strings, managed uniforms, managed defines, and `materialKind`;
4. call `definition.compile(draft)` without passing renderer/material;
5. validate returned strings and values;
6. normalize managed values and merge their `{ value }` wrappers into the internal Three parameters;
7. copy the controlled vertex/fragment strings back;
8. merge controlled defines into `parameters.defines` before Three builds the program;
9. inject the two reserved fragment uniforms exactly once.

Use a module-level `WeakMap<WebGLEffectMaterialShaderDefinition, number>` to give stable definition objects stable internal IDs. Implement `customProgramCacheKey()` as the base key plus material kind and ordered `key:definitionId` entries. Uniform values must never enter the cache key. Wrap callback exceptions with object ID, material kind, and extension key while preserving the original error as `cause`.

Registration rules:

```ts
onBeforeCompile(definition) {
  const key = readNonEmptyKey(definition.key);
  const existing = entries.get(key);
  if (existing?.definition === definition) return;
  if (existing) throw conflictingDefinition(options, key);
  entries.set(key, createEntry(definition));
  options.material.needsUpdate = true;
}
```

`remove(key)` disposes the entry's owned uniform resources, deletes it, and sets `material.needsUpdate = true`; an absent key is an idempotent no-op.

- [ ] **Step 4: Implement scalar, color, and vector uniform storage**

Normalize values without exposing Three instances:

- finite `number` and `boolean` remain scalars;
- `string` becomes `new Color(value)` so hex colors enter Three's working color space;
- 2/3/4 finite tuples become `Vector2`/`Vector3`/`Vector4`;
- vec2 tuple arrays become `Vector2[]`;
- invalid values throw an error containing object ID, material kind, extension key, and uniform name.

For `setUniforms(key, values)`, reject unknown extension keys and uniform names. Update vectors/colors in place when their shape is unchanged; otherwise replace every live wrapper's `.value`. Keep the canonical public value so a later program variant receives the latest value.

- [ ] **Step 5: Run focused unit tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialShader.test.ts
```

Expected: PASS for controlled source composition, stable cache key, string-color normalization, vector updates, idempotent same-definition registration, conflicting keys, unknown uniforms, contextual callback errors, and remove/re-register cache invalidation.

- [ ] **Step 6: Review checkpoint without staging**

Run `git diff --check` and inspect the new file for raw values escaping through the returned `facade`. Expected: the facade contains only the three public methods.

---

### Task 3: Complete viewport, multi-extension, texture, and lifecycle behavior

**Files:**
- Modify: `packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialShader.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialShader.ts`

**Interfaces:**
- Extends Task 2's host; no new public API.
- Produces production-ready `beforeRender()` and exactly-once `dispose()` for Task 4.

- [ ] **Step 1: Add RED tests for automatic screen-space inputs**

Add:

```ts
test("updates CSS viewport and DPR uniforms before render", () => {
  const material = new MeshStandardMaterial();
  const host = createManagedMaterialShaderHost({
    objectId: "mesh.hero",
    materialKind: "standard",
    material,
  });
  host.facade.onBeforeCompile({ key: "app.radial", compile() {} });
  const shader = createThreeShaderDraft();
  callMaterialCompile(material, shader);

  host.beforeRender({
    getSize(target) {
      return target.set(1200, 835);
    },
    getPixelRatio() {
      return 2;
    },
  });

  expect(shader.uniforms.domWebGLViewportSize?.value).toMatchObject({
    x: 1200,
    y: 835,
  });
  expect(shader.uniforms.domWebGLPixelRatio?.value).toBe(2);
});
```

Add a second compile call before the update and assert both program variants receive the same new values.

- [ ] **Step 2: Add RED tests for ordering and define conflicts**

Register `app.first` and `app.second`, append markers in each compile callback, and expect `FIRST` to occur before `SECOND`. Assert identical define names/values are accepted and conflicting values throw a contextual error before an invalid program is produced. Assert consumer uniforms named `domWebGLViewportSize` or `domWebGLPixelRatio` are rejected.

- [ ] **Step 3: Add RED tests for owned texture replacement and teardown**

Use two canvas elements and a `{ kind: "canvas-texture" }` uniform. Compile once, spy on the generated Three texture, update with the same canvas, then a different canvas, then dispose twice. Expected:

```ts
expect(firstDispose).toHaveBeenCalledTimes(1);
expect(secondDispose).toHaveBeenCalledTimes(1);
expect(materialDispose).not.toHaveBeenCalled();
```

The host owns its generated uniform textures but not the material. Add image/video cases and assert `{ kind: "source-texture" }` throws because a procedural managed mesh has no source texture.

- [ ] **Step 4: Run the expanded host test and verify RED**

Run the single test file. Expected: viewport, ordering/defines, and texture lifecycle tests fail against the Task 2 implementation.

- [ ] **Step 5: Implement viewport and DPR updates**

Use the `ManagedMaterialShaderRenderer` structural boundary defined in Task 2. Store one `Vector2` for CSS viewport size plus a set of numeric DPR wrappers for every compiled variant. `beforeRender()` calls `renderer.getSize(viewportSize)`, clamps invalid dimensions to `1`, clamps invalid DPR to `1`, updates all numeric wrappers, and returns immediately after host disposal.

- [ ] **Step 6: Implement ordered definitions and owned texture resources**

Use the same Three texture constructors and `createTextureUploadState()` policy already used by `materialLayer.ts`:

- `CanvasTexture` for canvas;
- `Texture` for image;
- `VideoTexture` for video;
- `upload.markUploadDirty("material-uniform")` on creation/reuse;
- dispose both upload state and runtime-created texture exactly once on replacement/removal/host disposal.

Keep these resources private to `ShaderExtensionEntry`. Do not modify existing material-layer semantics in this task.

- [ ] **Step 7: Implement host disposal**

Use the repository's idempotent pattern:

```ts
let disposed = false;

function dispose(): void {
  if (disposed) return;
  disposed = true;
  for (const entry of entries.values()) disposeEntry(entry);
  entries.clear();
  restoreOwnedProperty(material, "onBeforeCompile", baseOnBeforeCompileState);
  restoreOwnedProperty(
    material,
    "customProgramCacheKey",
    baseCustomProgramCacheKeyState,
  );
  compiledViewportUniforms.clear();
  compiledPixelRatioUniforms.clear();
}
```

Capture whether each hook was originally an own property. `restoreOwnedProperty()` assigns the saved value when it was own and uses `Reflect.deleteProperty()` when it originally came from the Three prototype. Test both hook values and `Object.hasOwn()` before/after disposal. Do not call `material.dispose()` here; the managed mesh remains its owner.

- [ ] **Step 8: Run host and existing material-layer regressions**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialShader.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/materialLayer.test.ts
```

Expected: PASS, including existing replace/overlay material-layer behavior.

- [ ] **Step 9: Review checkpoint without staging**

Run `git diff --check`. Confirm no app literal appears under `packages/dom-webgl-runtime/src` and no public method returns Three objects.

---

### Task 4: Wire the host into managed materials and the real runtime pipeline

**Files:**
- Modify: `packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialControls.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts:3923-4130`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/managedMaterialControls.ts:12-76`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedStageObjects.ts:29-62`

**Interfaces:**
- Consumes: `createManagedMaterialShaderHost()` from Tasks 2-3.
- Produces: real runtime-owned Basic/Standard/Physical materials with `ctx.object.material.shader`.
- Consumers: Hero and tarball tasks.

- [ ] **Step 1: Add the missing-facade RED test**

In `managedMaterialControls.test.ts`, create a three-method fake shader facade and inject it:

```ts
const shader = {
  onBeforeCompile: vi.fn(),
  setUniforms: vi.fn(),
  remove: vi.fn(),
} satisfies WebGLEffectMaterialShaderFacade;
const facade = createManagedMaterialFacade({ material, shader });

expect(facade.shader).toBe(shader);
expect("material" in facade.shader).toBe(false);
expect("dispose" in facade.shader).toBe(false);
```

Keep the existing no-layer-host behavior unchanged.

- [ ] **Step 2: Add managed mesh RED tests**

In `managedStageObjects.test.ts`, use a real Standard material object and assert:

- `object.effectCapabilities?.material?.shader` exists;
- `object.object3D` remains a real `Mesh`;
- its material remains `MeshStandardMaterial` after registering a callback;
- calling `object.dispose()` twice restores hooks and disposes geometry/material once.

Add table coverage for Basic, Standard, and Physical descriptors without changing their classes or current scalar fields.

- [ ] **Step 3: Add the required real pipeline RED test**

Beside the existing physical-facade test in `runtimePipeline.test.ts`, define a real mesh effect:

```ts
const shaderEffect = defineWebGLSceneObjectEffect({
  kind: "test.managedShader",
  source: "mesh",
  setup(ctx) {
    const shader = ctx.object.material?.shader;
    if (!shader) throw new Error("Expected managed material shader facade.");
    shader.onBeforeCompile({
      key: "test.radial",
      uniforms: { radius: 0 },
      compile(draft) {
        draft.fragmentShader = `uniform float radius;\n${draft.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\nfloat runtimeMarker = radius;",
        )}`;
      },
    });
  },
  update(ctx) {
    ctx.object.material?.shader?.setUniforms("test.radial", { radius: 24 });
  },
});
```

Register Standard and Physical meshes through the real `createPipelineRuntime`, default `createManagedMeshObject`, recording scene adapter, and real Three materials. After `runtime.sync()`, manually invoke each real material's internal compile hook and assert source marker, uniform value `24`, class preservation, public boundary booleans, and exactly-once disposal. Also retain the existing Basic/Standard/Physical regression test.

- [ ] **Step 4: Run the three focused tests and verify RED**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/renderables/managedMaterialControls.test.ts packages/dom-webgl-runtime/test/lib/renderer/managedStageObjects.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: new assertions fail because the facade and managed mesh factory do not yet receive a shader host.

- [ ] **Step 5: Inject the public facade into material controls**

Extend the internal target only:

```ts
type MaterialMutationTarget = {
  readonly material: unknown;
  readonly layerHost?: WebGLEffectMaterialLayerHost;
  readonly shader?: WebGLEffectMaterialShaderFacade;
  restoreMaterial?(): void;
};
```

Spread `...(target.shader ? { shader: target.shader } : {})` into the returned facade. Do not make `createManagedMaterialFacade()` construct or own a host.

- [ ] **Step 6: Create and connect one host per managed mesh**

In `createManagedMeshObject()`:

1. create geometry and real material as today;
2. create the real `Mesh`;
3. create `shaderHost` using declaration ID and normalized material kind;
4. capture `mesh.onBeforeRender`;
5. replace it with a runtime callback that calls `shaderHost.beforeRender(renderer)` and then the captured callback with the original arguments/`this`;
6. pass `shaderHost.facade` into `createManagedMaterialFacade()`;
7. on object disposal, restore the mesh callback, dispose host, geometry, then material, each once.

Do not pass renderer/material through the public effect object.

- [ ] **Step 7: Run package integration and regression tests**

Run the three focused files from Step 4, then:

```bash
npm test -- --run packages/dom-webgl-runtime/test
```

Expected: PASS. Standard/Basic/Physical remain their original Three classes; the real pipeline test uses no facade mock.

- [ ] **Step 8: Review checkpoint without staging**

Run `git diff --check` and `git status --short`. Inspect `packages/dom-webgl-runtime/src` for hero literals using the existing open-source boundary test rather than adding an app branch.

---

### Task 5: Replace the Hero tetrahedron hard cut with the shared radial shader

**Files:**
- Create: `apps/hero-next/test/heroTetrahedronShader.test.ts`
- Create: `apps/hero-next/src/heroTetrahedronShader.ts`
- Modify: `apps/hero-next/test/heroEffect.test.ts:1-374`
- Modify: `apps/hero-next/test/heroHoldTransition.test.ts:99-125`
- Modify: `apps/hero-next/src/heroEffect.ts:1-256`
- Modify: `apps/hero-next/src/heroHoldTransition.ts:30-39,193-209`

**Interfaces:**
- Consumes: `WebGLEffectMaterialShaderDefinition` and `material.shader` from Tasks 1-4.
- Produces:

```ts
export const heroTetrahedronRadialShader: WebGLEffectMaterialShaderDefinition;

export function createHeroTetrahedronRadialUniforms(
  transition: HeroHoldTransitionState,
  viewport: HeroViewport,
): Record<string, WebGLEffectUniformValue>;
```

- Consumer: `heroTetrahedronEffect`.

- [ ] **Step 1: Turn the existing hard-cut test into RED evidence**

Extend `createTarget()` with:

```ts
shader: {
  onBeforeCompile: vi.fn(),
  setUniforms: vi.fn(),
  remove: vi.fn(),
},
```

Replace `uses target foreground through expansion...` with expectations that the material base remains committed and the shader receives both palettes plus the same radial geometry:

```ts
applyHeroFrame(target, motion, 0, expanding, desktop, false);

expect(target.material.color.set).toHaveBeenLastCalledWith("#5F5F5F");
expect(target.material.emissive.set).toHaveBeenLastCalledWith("#5F5F5F", 0.06);
expect(target.material.shader.setUniforms).toHaveBeenLastCalledWith(
  "hero.tetrahedron.radial",
  expect.objectContaining({
    heroCommittedColor: "#5F5F5F",
    heroTargetColor: "#B8B8B8",
    heroRadialOrigin: [0.5, 0.5],
    heroRadialEdgePx: 1.5,
  }),
);
```

Assert the radius decreases between an expanding frame and a later retracting frame and remains derived from `resolveHeroRadialGeometry()`.

- [ ] **Step 2: Run the Hero effect test and verify RED**

Run:

```bash
npm test -- --run apps/hero-next/test/heroEffect.test.ts
```

Expected: FAIL because the current implementation sets the full target material and has no shader uniform updates. Preserve this output as the requested hard-cut RED evidence.

- [ ] **Step 3: Write shader-source RED tests**

Create `heroTetrahedronShader.test.ts` and assert:

```ts
const draft = {
  materialKind: "standard",
  vertexShader: "#include <begin_vertex>",
  fragmentShader: "#include <emissivemap_fragment>\n#include <lights_fragment_begin>",
  uniforms: {},
  defines: {},
} satisfies WebGLEffectMaterialShaderDraft;

heroTetrahedronRadialShader.compile(draft);

expect(draft.fragmentShader).toContain("gl_FragCoord.xy / domWebGLPixelRatio");
expect(draft.fragmentShader).toContain(
  "heroRadialOrigin * domWebGLViewportSize",
);
expect(draft.fragmentShader).toContain(
  "heroRadialRadiusPx - heroRadialEdgePx",
);
expect(draft.fragmentShader).toContain(
  "heroRadialRadiusPx + heroRadialEdgePx",
);
expect(draft.fragmentShader).toContain(
  "diffuseColor.rgb = mix(heroCommittedColor, heroTargetColor, heroRadialMask)",
);
expect(draft.fragmentShader).toContain("totalEmissiveRadiance = mix(");
expect(draft.fragmentShader.indexOf("heroRadialMask")).toBeLessThan(
  draft.fragmentShader.indexOf("#include <lights_fragment_begin>"),
);
expect(draft.fragmentShader).not.toContain("noise(");
```

Test uniform resolution for initial, half-expanded, retracting, committed-inverted, and second-direction states. Expect the exact `origin`, `resolveHeroRadialGeometry().radiusPx`, `1.5`, committed/target strings, and emissive intensity.

- [ ] **Step 4: Implement the Hero shader module**

Declare the GLSL uniforms in the inserted source and replace only the Standard/Physical `emissivemap_fragment` anchor. The injected code must be equivalent to:

```glsl
vec2 heroFragmentCssPx = gl_FragCoord.xy / domWebGLPixelRatio;
vec2 heroOriginCssPx = heroRadialOrigin * domWebGLViewportSize;
float heroRadialDistancePx = length(heroFragmentCssPx - heroOriginCssPx);
float heroRadialMask = 1.0 - smoothstep(
  heroRadialRadiusPx - heroRadialEdgePx,
  heroRadialRadiusPx + heroRadialEdgePx,
  heroRadialDistancePx
);
diffuseColor.rgb = mix(
  heroCommittedColor,
  heroTargetColor,
  heroRadialMask
);
totalEmissiveRadiance = mix(
  heroCommittedEmissive * heroCommittedEmissiveIntensity,
  heroTargetEmissive * heroTargetEmissiveIntensity,
  heroRadialMask
);
```

Throw a contextual app error if the material kind is Basic or the expected Three chunk is missing. Do not add a Physical descriptor to Hero.

- [ ] **Step 5: Remove the whole-material visual branch**

Change `HeroTransitionVisualState` to contain only `committed` and `target`. Make `resolveHeroTransitionVisual()` independent of phase and delete `tetrahedronForeground`.

In `heroEffect.ts`:

- change setup to receive `ctx`, require `ctx.object.material?.shader`, call `onBeforeCompile(heroTetrahedronRadialShader)` once, then return the current Hero state;
- keep `material.color` and `material.emissive` on `visual.committed.foreground`;
- call `material.shader?.setUniforms("hero.tetrahedron.radial", createHeroTetrahedronRadialUniforms(transition, viewport))` every frame;
- keep opacity, metalness, roughness, transforms, signals, pointer-hit logic, and reduced-motion state unchanged.

Add a setup test that calls `heroTetrahedronEffect.setup` with the controlled context, asserts `onBeforeCompile` receives `heroTetrahedronRadialShader` exactly once, and asserts no raw material/renderer value is requested by app code.

- [ ] **Step 6: Update state-machine assertions without changing the state machine**

In `heroHoldTransition.test.ts`, replace assertions on removed `tetrahedronForeground` with:

```ts
expect(resolveHeroTransitionVisual(cancelled)).toEqual({
  committed: { background: "#B8B8B8", foreground: "#5F5F5F" },
  target: { background: "#B8B8B8", foreground: "#5F5F5F" },
});
```

Do not change timing, coverage math, far-corner geometry, resume, or awaiting-release code.

- [ ] **Step 7: Run all Hero tests**

Run:

```bash
npm test -- --run apps/hero-next/test
```

Expected: PASS. The new tests prove committed base material + target shader uniforms, forward/retract radius continuity, `1.5px` edge, no noise, and reduced-motion diffusion.

- [ ] **Step 8: Review checkpoint without staging**

Run `git diff --check`. Confirm key/rim/pointer lights and `HeroExperience.tsx` material kind remain unchanged.

---

### Task 6: Prove the public capability through packed tarballs in Chromium

**Files:**
- Modify: `scripts/external-consumer-fixture.mjs:90-585`
- Test: `test/external-consumer-fixture.test.ts`

**Interfaces:**
- Consumes: only packed public `@viselora/dom-webgl` and React entrypoints.
- Produces: `radialStartLikePixels`, `radialTargetLikePixels`, `radialEndpointChangedPixels`, zero console/page errors, and one-canvas lifecycle evidence.

- [ ] **Step 1: Add a tarball fixture shader effect**

Inside the generated `effects.ts`, add a module-level `fixture.radialMaterial` definition using public imports only. Register it in setup and update `fixture.radial` from the progress signal:

```ts
export const fixtureRadialMaterialEffect = defineWebGLSceneObjectEffect({
  kind: "fixture.radialMaterial",
  source: "mesh",
  schedule: "reactive",
  setup(ctx) {
    const shader = ctx.object.material?.shader;
    if (!shader) throw new Error("Expected managed material shader facade.");
    shader.onBeforeCompile({
      key: "fixture.radial",
      uniforms: {
        fixtureOrigin: [0.5, 0.5],
        fixtureCoverage: 0,
        fixtureStartColor: "#ff315f",
        fixtureTargetColor: "#29e7ff",
      },
      compile(draft) {
        const uniforms = `
          uniform vec2 fixtureOrigin;
          uniform float fixtureCoverage;
          uniform vec3 fixtureStartColor;
          uniform vec3 fixtureTargetColor;
        `;
        const chunk = `
          #include <emissivemap_fragment>
          vec2 fixturePointPx = gl_FragCoord.xy / domWebGLPixelRatio;
          vec2 fixtureOriginPx = fixtureOrigin * domWebGLViewportSize;
          float fixtureRadiusPx = fixtureCoverage * length(domWebGLViewportSize);
          float fixtureMask = 1.0 - smoothstep(
            fixtureRadiusPx - 1.5,
            fixtureRadiusPx + 1.5,
            length(fixturePointPx - fixtureOriginPx)
          );
          diffuseColor.rgb = mix(
            fixtureStartColor,
            fixtureTargetColor,
            fixtureMask
          );
        `;
        draft.fragmentShader = uniforms + draft.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          chunk,
        );
      },
    });
  },
  update(ctx) {
    ctx.object.material?.shader?.setUniforms("fixture.radial", {
      fixtureCoverage: ctx.progress.get("fixture.radial"),
    });
  },
});
```

The actual generated GLSL must declare the uniforms, use `gl_FragCoord`, `domWebGLViewportSize`, and `domWebGLPixelRatio`, then assign `diffuseColor.rgb` before lighting. Add this effect to `runtimeEffects`.

- [ ] **Step 2: Add a visible Standard mesh and browser control**

Initialize `fixture.radial` to `0`, expose `window.__fixtureSetRadial(coverage)` and render a lit Standard box on the right side of the existing scene with `effects={[{ kind: "fixture.radialMaterial" }]}`. Keep the current Physical fixture and all its assertions. Browser states are coverage `0`, a measured crossing value near `0.22`, and `1`; values remain normalized progress signals.

- [ ] **Step 3: Add mixed-pixel Chromium assertions**

Capture the canvas at coverage `0`, coverage `0.22` crossing the box, and coverage `1`. Use the fixed Chromium viewport's right-side mesh region `{ x: 480, y: 90, width: 460, height: 520 }`. Compare each intermediate pixel with the same pixel in the two endpoint images:

```ts
const radialMix = classifyRadialMix(
  radialStart,
  radialMiddle,
  radialTarget,
  radialRegion,
);
expect(radialMix.endpointChangedPixels).toBeGreaterThan(500);
expect(radialMix.startLikePixels).toBeGreaterThan(100);
expect(radialMix.targetLikePixels).toBeGreaterThan(100);
```

`classifyRadialMix()` must ignore pixels whose start/target RGB delta is at most `24`; for the rest, classify the middle pixel by whichever endpoint has the smaller RGB Manhattan distance. Store these three measurements in `browser-capabilities.json`. Continue asserting console errors, console warnings, and page errors are empty and canvas lifecycle is `[1, 0, 1]`.

In `test/external-consumer-fixture.test.ts`, add exact generated-contract assertions:

```ts
expect(effects).toContain("ctx.object.material?.shader");
expect(effects).toContain("shader.onBeforeCompile");
expect(effects).toContain("domWebGLViewportSize");
expect(effects).toContain("gl_FragCoord");
expect(app).toContain('id="fixture.radial"');
expect(browser).toContain("classifyRadialMix");
expect(browser).toContain("radialStartLikePixels");
expect(browser).toContain("radialTargetLikePixels");
```

- [ ] **Step 4: Run fixture structure tests**

Run:

```bash
npm test -- --run test/external-consumer-fixture.test.ts
```

Expected: PASS with the eight new generated-contract assertions and all existing model/physical assertions.

- [ ] **Step 5: Run the packed consumer verification**

Run:

```bash
npm run verify:consumer
```

Expected: PASS through install, SSR import, typecheck, Vitest, Vite build, and real Chromium. Evidence must report both start-like and target-like pixels inside the target mesh region and zero console/page errors.

- [ ] **Step 6: Protect the user file immediately**

Run:

```bash
shasum -a 256 apps/hero-next/next-env.d.ts
```

Expected exactly `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`. If different, use a focused `apply_patch` to restore only the build rewrite and re-run the hash command.

---

### Task 7: Document the thin-shell capability and regenerate public API guidance

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/effect-object-boundary.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `apps/hero-next/VISUAL_DESIGN.md`
- Generate: files changed by `npm run skill:api:generate`

**Interfaces:**
- Documents the exact Task 1 public signatures and Task 5 Hero behavior.

- [ ] **Step 1: Add one canonical public example**

Use the same short example everywhere it is needed; the detailed reference lives in `package-usage.md`:

```ts
const tint = {
  key: "app.tint",
  uniforms: { tintColor: "#7dd3fc" },
  compile(shader) {
    shader.fragmentShader = `uniform vec3 tintColor;\n${shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb *= tintColor;",
    )}`;
  },
} satisfies WebGLEffectMaterialShaderDefinition;

setup(ctx) {
  ctx.object.material?.shader?.onBeforeCompile(tint);
}

update(ctx) {
  ctx.object.material?.shader?.setUniforms("app.tint", {
    tintColor: "#38bdf8",
  });
}
```

Declare the custom GLSL uniform in the actual documented compile snippet. Explain in one sentence: agent edits a controlled Three-like draft; runtime owns the real material, caching, DPR, and cleanup.

- [ ] **Step 2: Document boundaries and performance rules**

Record these exact operational rules:

- definition object and shader source are stable/module-level;
- call managed `onBeforeCompile()` in setup;
- call `setUniforms()` in update;
- uniform changes do not recompile;
- no raw Three object or disposal is returned;
- Standard/Physical lighting continues after the injected chunk;
- `domWebGLViewportSize` and `domWebGLPixelRatio` are reserved runtime uniforms;
- callback source changes require remove + re-register, not public `needsUpdate`.

- [ ] **Step 3: Update active status and Hero visual truth**

Mark the package capability and Hero mesh diffusion implemented only after Tasks 1-6 pass. In `VISUAL_DESIGN.md`, state that background, Ghost Cursor, and tetrahedron share the same screen-space radial boundary, `1.5px` feather, and no v1 edge noise. Do not edit the completed 2026-07-16 spec or `docs/archive/`.

- [ ] **Step 4: Regenerate and check the skill API**

Run:

```bash
npm run skill:api:generate
npm run skill:api:check
```

Expected: generated API includes the four new public types and checks PASS. Review generated diffs; do not hand-edit generated files.

- [ ] **Step 5: Review checkpoint without staging**

Run `git diff --check` and confirm docs consistently say managed `onBeforeCompile`, never describe shader extension as package installation, never claim raw callback ownership, and never describe a Hero-specific package capability.

---

### Task 8: Final automated gates and real production Hero Playwright evidence

**Files:**
- Evidence only: `output/` or `.playwright-cli/` (already user-owned untracked directories; do not delete them)
- Protect: `apps/hero-next/next-env.d.ts`

**Interfaces:**
- Verifies the complete story; produces no new public API.

- [ ] **Step 1: Read the Playwright skill before browser work**

Read `/Users/ai/.codex/skills/playwright/SKILL.md` completely and follow its server/session/evidence workflow. Use the production Next runtime, not a jsdom approximation.

- [ ] **Step 2: Run the required automated verification in exact order**

Run each command separately and stop on the first failure. If any command fails unexpectedly, switch to `superpowers:systematic-debugging`, identify root cause, add/adjust the narrow test, then restart from the failed gate.

```bash
npm test -- --run packages/dom-webgl-runtime/test
npm test -- --run apps/hero-next/test
npm run typecheck
npm run build
npm run check:imports
npm run skill:api:generate
npm run skill:api:check
npm run verify:tarballs
npm run verify:consumer
npm run verify:skill
git diff --check
```

Expected: every command PASS.

- [ ] **Step 3: Verify and restore the protected file after every build-like gate**

Immediately after `npm run build`, `npm run verify:tarballs`, `npm run verify:consumer`, and `npm run verify:skill`, run:

```bash
shasum -a 256 apps/hero-next/next-env.d.ts
```

Expected exactly:

```text
7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc
```

If a gate rewrites the file, restore only the generated-line change with `apply_patch`; never use Git restore commands.

- [ ] **Step 4: Start the production Hero runtime**

Build has already completed. Start a persistent server:

```bash
npm run start -w @viselora/hero-next -- --hostname 127.0.0.1 --port 4180
```

Expected: Next reports the production server ready at `http://127.0.0.1:4180`.

- [ ] **Step 5: Capture the five required visual states**

In Chromium at a fixed desktop viewport, assert one canvas and capture:

1. initial palette before press;
2. first-direction intermediate expansion while holding the real tetrahedron hit point;
3. committed target after the far-corner radius completes;
4. reverse-direction intermediate expansion during the second toggle;
5. committed initial-return.

Also perform an early-release attempt and capture the shrinking intermediate boundary. The boundary on the tetrahedron must line up with the background circle in every intermediate frame. Record screenshots under the existing untracked evidence directory, not under tracked source.

- [ ] **Step 6: Record browser assertions**

For the session, assert:

- `document.querySelectorAll("canvas").length === 1` in every state;
- the intermediate tetrahedron region contains committed-like and target-like pixels separated by a curved screen-space boundary;
- early release decreases the same boundary without a whole-mesh cut;
- re-press resumes rather than restarting;
- reduced-motion emulation retains color diffusion and removes shake;
- console errors, page errors, and WebGL shader errors are all zero.

- [ ] **Step 7: Final worktree audit**

Run:

```bash
git status --short
shasum -a 256 apps/hero-next/next-env.d.ts
git diff --check
```

Expected: protected hash is exact; user-owned untracked paths remain; no file is staged; no commit or push was created. Summarize implemented, automated-verified, browser-verified, documented, and uncommitted states separately.
