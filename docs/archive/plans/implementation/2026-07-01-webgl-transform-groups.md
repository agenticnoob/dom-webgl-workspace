# WebGL Transform Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a declarative WebGL transform group capability so a parent `WebGLTarget` can move, rotate, scale, flip, or hide its WebGL subtree while child targets keep their own source, effects, textures, and lifecycle.

**Architecture:** Keep the public API high-level by adding a narrow transform-scope declaration on `WebGLDeclaration`; do not expose Three.js objects, scene, camera, or materials. Internally, reuse the existing DOM-derived target tree and layer ordering, add a runtime scene/group manager that attaches target scene objects under transform groups, and keep layout, resource loading, and lifecycle target-scoped.

**Tech Stack:** TypeScript, Three.js internal adapter, React adapter, Vitest/jsdom, npm workspaces.

---

## Current Truth

Verified on 2026-07-01 in `/Users/ai/AgentWorkspace/projects/dom-webgl-workspace`:

- Current branch: `codex/effect-authoring-examples`.
- Current head: `75c14463 Optimize example waves with GPU material layer`.
- `.codegraph/` is present and CodeGraph was used for source truth.

### Target Registration And Tree

- React `WebGLTarget` registers only `(element, webgl declaration)` through `runtime.registerTarget(element, webglRef.current)` and unregisters by `webgl.key`.
- `createTargetRegistry()` stores flat `TargetDescriptor` records keyed by declaration key plus scan order.
- `createTargetLayerTree(descriptors)` already derives target ancestry from DOM ancestry:
  - `parentKey`: nearest ancestor DOM element that is also a WebGL target.
  - `depth`: target depth in that WebGL target tree.
  - `siblingIndex`: DOM-order index among sibling targets.
  - `paintIndex`: DFS paint order.
- This target tree is currently recomputed every frame in `syncTargetLayerOrdering(descriptors)`.

### Ordering And Layering

- Runtime uses the tree for debug and render ordering, not for transform inheritance.
- `toScopedSceneObjectOrdering(policy, layer)` computes `renderOrder = layer.paintIndex * 100 + localRoleOffset`.
- Role offsets currently keep each target's local order stable:
  - `surface: 0`
  - `media: 10`
  - `model: 20`
  - `content: 30`
  - `overlay: 40`
- The scene is still flat: `createThreeSceneAdapter().addObject()` calls `scene.add(object.object3D ?? object)`.

### Layout Projection

- DOM layout is measured in one runtime pass by `layoutPass.measure(...)`.
- Each renderable projects its own DOM measurement through `projectDOMRectToSceneLayout(...)`.
- `updateObject3DLayout(object3D, layout)` writes:
  - `object3D.position = (layout.x, layout.y, 0)`
  - `object3D.scale = (layout.width, layout.height, 1)`
- This is absolute scene-space layout today.

### Effect Target

- `createPipelineRenderable(...)` creates a renderable and an effect controller per target.
- `ctx.target` is backed by `renderable.effectTarget`.
- `createTrackedEffectTarget(...)` forwards `setVisible`, `setPosition`, `setRotation`, `setScale`, and `setOpacity` directly to the target renderable.
- For typical renderables, `createObject3DControls(...)` writes directly to the renderable's internal root object.
- `ctx.target.setPosition(...)` is documented and implemented as scene-space, not DOM `left/top`.
- Effects run after `renderable.updateLayout(...)`, so effect target transforms can override the layout transform for that frame.

### Lifecycle And Visibility

- Lifecycle is target-scoped:
  - each target has its own renderable, effect controller, fallback controller, parked/disposed state, and debug record.
  - far-offscreen `restore-dom` disposes that target renderable and restores its fallback.
  - `park` hides that target renderable and preserves resources until TTL/disposal.
- There is no parent-owned disposal cascade today.
- `hideMode: "subtree"` hides the DOM subtree fallback; this can hide child fallback DOM even when child WebGL targets are loading. That behavior already exists and should be called out in docs for transform groups.

### Sequence Card Pain Point

`apps/example/src/App.tsx` currently nests `example.image-sequence.card` inside `example.image-sequence.scrub`. The card target owns background/border/glow and uses `example.sequenceCardSlide` to move itself. Its `<strong>` and `<span>` are still ordinary DOM children. If those children become `dom/text` targets today, they will not inherit the card slide/flip transform unless each child repeats the same effect.

---

## Public API Recommendation

Prefer a single parent-side declaration:

```ts
export type WebGLTransformScope = "self" | "subtree";

export type WebGLDeclaration = {
  key: string;
  source?: WebGLSourceDeclaration;
  renderRole?: WebGLRenderRole;
  scroll?: WebGLScrollBehavior;
  pointer?: WebGLPointerDeclaration;
  lifecycle?: WebGLLifecycleDeclaration;
  effects?: WebGLEffectsDeclaration;
  transformScope?: WebGLTransformScope;
};
```

Usage:

```tsx
<WebGLTarget
  as="aside"
  className="example-sequence-card"
  webgl={{
    key: "example.image-sequence.card",
    source: { kind: "dom", type: "element" },
    transformScope: "subtree",
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    effects: sequenceCardEffects,
  }}
>
  <WebGLTarget
    as="strong"
    webgl={{
      key: "example.image-sequence.card.title",
      source: { kind: "dom", type: "text" },
      lifecycle: { hideWhenReady: true, hideMode: "self" },
      effects: [
        {
          kind: "example.textReveal",
          color: "#f4f4f5",
          progressKey: "example.video.scrub",
        },
      ],
    }}
  >
    固定区间卡片
  </WebGLTarget>
</WebGLTarget>
```

Why this shape:

- `transformScope: "subtree"` is parent-owned, declarative, and does not require children to repeat `parent` keys.
- It keeps the public mental model at "this target's transform controls its WebGL subtree".
- It uses DOM nesting as the tree source, which already exists and is easy for AI agents to generate correctly in React.
- It avoids a public `group` object, public scene graph API, or raw Three.js handles.

Alternatives not recommended for v1:

- `parent: "some.key"` on children: useful for portals later, but higher friction and easy to desynchronize from DOM structure.
- `group: { ... }`: too close to scene-graph terminology and likely to grow into raw graph management.
- Public transform matrices or object handles: violates the current boundary.

Future-compatible option:

```ts
export type WebGLTransformDeclaration = {
  scope?: "self" | "subtree";
  origin?: "center";
};
```

Do not add this object shape in v1 unless the implementation needs `origin` immediately. Start with `transformScope` to keep the public API minimal.

---

## Internal Architecture

### Where The Capability Belongs

Put transform groups between the runtime target tree and scene object attachment/layout:

```text
TargetDescriptor list
  -> createTargetLayerTree()
  -> transform group planner
  -> renderable scene object attachment
  -> layout projection as root/local scene layout
  -> effect target selection
  -> effect update
  -> render
```

Do not put this in:

- source inference: child source ownership must remain independent.
- resource manager: textures/videos/models remain child-owned.
- React adapter: React should still only register targets.
- public effect definitions: effects should not have to scan DOM or wire children.

### New Internal Unit

Create `packages/dom-webgl-runtime/src/lib/render/transformGroups.ts`.

Responsibilities:

- Read `WebGLDeclaration.transformScope`.
- Determine which target keys are subtree transform roots.
- Find the nearest transform root ancestor for each target.
- Compute scene attachment:
  - parent group key for each target scene object.
  - local projected layout for renderables under a transform root.
  - group projected layout for transform roots.
- Keep this independent from source type.

Suggested internal types:

```ts
import type { TargetDescriptor } from "../dom/targetDescriptor";
import type { TargetLayerRecord } from "../dom/targetTree";
import type { ProjectedDOMRect } from "../renderer/domProjection";

export type TransformScope = "self" | "subtree";

export type TransformGroupRecord = {
  key: string;
  parentGroupKey: string | undefined;
  layout: ProjectedDOMRect;
};

export type TransformAttachmentRecord = {
  key: string;
  groupKey: string | undefined;
  layout: ProjectedDOMRect;
};
```

### Scene Adapter Changes

Modify `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts` and `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts` with internal-only group support.

Add optional group operations to `WebGLSceneAdapter`:

```ts
export type WebGLSceneGroup = {
  readonly key: string;
  readonly object3D?: unknown;
};

export type WebGLSceneAdapter = {
  addObject(object: WebGLSceneObject): void;
  removeObject(object: WebGLSceneObject): void;
  createGroup?(key: string): WebGLSceneGroup;
  addGroup?(group: WebGLSceneGroup, parent?: WebGLSceneGroup): void;
  removeGroup?(group: WebGLSceneGroup): void;
  setObjectParent?(object: WebGLSceneObject, parent?: WebGLSceneGroup): void;
  setGroupParent?(group: WebGLSceneGroup, parent?: WebGLSceneGroup): void;
  render(): void;
};
```

Three implementation:

- `createGroup(key)` returns a `Group`.
- `setObjectParent(object, parent)` uses `parent.object3D.add(object.object3D)` or `scene.add(object.object3D)`.
- `removeObject(object)` must remove from the object's actual parent when present, not only from `scene`.

The adapter remains internal; nothing is exported from the public package entry.

### Layout Projection Rule

Keep DOM layout as source of truth.

For a transform root target:

- group layout position = parent target projected center.
- parent target's own renderable local layout:
  - `x: 0`
  - `y: 0`
  - same `width`, `height`, viewport, etc.

For a descendant target under nearest transform root:

- child local layout position = child projected center minus transform root projected center.
- child size remains its own measured DOM size.

For targets outside transform roots:

- keep current absolute projected layout.

This means a parent card can slide/flip/scale around its center and its child text/media targets follow, while each child still measures and rasterizes from its own DOM element.

### Effect Target Rule

For `transformScope: "subtree"` targets:

- `ctx.target.setPosition`, `setRotation`, `setScale`, and `setVisible` should control the internal transform group.
- The target's source handles (`ctx.source.surface`, text layer, texture layer, model handle) still point to the target's own renderable/source.
- `ctx.target.setOpacity` can apply to the group in v1, but docs and tests should avoid promising correct multiplicative opacity when descendants also write opacity in the same frame. Spatial transform is the guaranteed behavior.

For child targets:

- Child source/effect/resource lifecycle remains independent.
- Child source effects (`textLayer`, `surface`, texture/material layers) continue to work normally.
- Child `ctx.target` spatial transforms are allowed, but tests should cover at least translation under a translated parent. Full matrix-correct child target controls under parent `rotateX/rotateY` can be marked as future work if the internal group approach cannot preserve scene-space semantics cleanly without more matrix plumbing.

### Ordering Rule

Do not use transform groups to replace render ordering.

- Keep existing `targetLayersByTargetKey`, `orderingsByTargetKey`, and `managedOrderingsByTargetKey`.
- Apply render ordering to actual renderable objects and managed objects, not to the transform group alone.
- Debug state can keep current `parentKey`, `layerDepth`, `siblingIndex`, and `computedRenderOrder`.
- Optional debug addition later: `transformGroupKey` or `transformScope`; not required for v1 unless tests need it.

### Lifecycle Rule

- Transform groups are runtime attachment nodes, not resource owners.
- Child target disposal/parking remains child-owned.
- Parent target disposal should not directly dispose child targets.
- When a transform root is unregistered or its group is removed:
  - detach/reparent active children to the nearest remaining transform ancestor or scene root.
  - remove the empty group.
- If a parent transform root is far-offscreen/disposed and no active child needs it, remove the group.
- If a child is active but its transform root has no measured layout for the frame, attach the child to scene root for that frame rather than leaking a stale group transform.

### Pointer Boundary

Keep v1 pointer coordinates as they are:

- `ctx.pointer` remains global canvas pointer state.
- `ctx.layout` remains DOM/layout-space for that target.
- Parent transform does not rewrite pointer hit testing.

Document this clearly:

- Slide/fly-in effects can compensate with known offsets, as `sequenceCardEffect.ts` already does for card glow.
- Rotated/flipped subtree picking is not v1.
- Do not add complex picking, raycasting, or target-local inverse matrix APIs in this capability.

---

## TDD Task Breakdown

### Task 1: Public Type Contract

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] Add `WebGLTransformScope` to `types.ts`.
- [x] Add `transformScope?: WebGLTransformScope` to `WebGLDeclaration`.
- [x] Export `WebGLTransformScope` from `src/index.ts`.
- [x] Add public type tests proving:
  - `"subtree"` is accepted.
  - `"self"` is accepted.
  - arbitrary strings are rejected.
  - no `parent` or `group` field is accepted as public API.

Focused command:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected first run before implementation: type test fails because `transformScope` is not part of `WebGLDeclaration`.

### Task 2: Transform Scope Planner

**Files:**

- Create: `packages/dom-webgl-runtime/src/lib/render/transformGroups.ts`
- Test: `packages/dom-webgl-runtime/test/lib/render/transformGroups.test.ts`
- Reuse: `packages/dom-webgl-runtime/src/lib/dom/targetTree.ts`

- [x] Write tests for a nested DOM tree:
  - `sequence` root target.
  - `card` child target with `transformScope: "subtree"`.
  - `card.title` grandchild text target.
- [x] Assert `card` is a transform root.
- [x] Assert `card.title` attaches to `card`.
- [x] Assert siblings outside `card` attach to root.
- [x] Assert nested transform roots stop propagation: a child with its own `transformScope: "subtree"` becomes a new root for its descendants.
- [x] Implement the planner with no DOM reads; it should consume descriptors, layer records, and projected layouts supplied by runtime.

Focused command:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/render/transformGroups.test.ts packages/dom-webgl-runtime/test/lib/dom/targetTree.test.ts
```

Expected first run before implementation: missing module failure.

### Task 3: Internal Scene Group Adapter

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/sceneObject.test.ts`

- [x] Add internal `WebGLSceneGroup` and optional group operations to `WebGLSceneAdapter`.
- [x] Implement group creation and parent changes in the Three adapter with `Group`.
- [x] Make `removeObject` remove from actual object parent when available.
- [x] Keep existing scene adapter tests passing for adapters that do not implement group operations.
- [x] Add tests using fake group/object stubs to prove:
  - object can move from scene root to group.
  - object can move back to scene root.
  - removing an object under a group detaches it from that group.
  - duplicate add/remove remains idempotent.

Focused command:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/sceneObject.test.ts packages/dom-webgl-runtime/test/lib/renderer/threeRenderer.test.ts
```

Expected first run before implementation: missing group API assertions fail.

### Task 4: Runtime Group Wiring And Local Layout

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableController.ts`
- Modify as needed only for option plumbing:
  - `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] Add a runtime-owned transform group state map.
- [x] Build transform attachments after layout measurements are available and before renderables update layout.
- [x] Let `SceneRenderableControllerOptions` accept a `projectLayout(measurement, viewport)` override.
- [x] Pass the runtime projection override through `RenderableFactoryContext`.
- [x] For grouped targets, project layout to group-local coordinates.
- [x] Reparent target scene objects to the nearest transform group after attach.
- [x] Keep non-grouped target layout/output byte-for-byte compatible with existing behavior.

Focused command:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Add runtime pipeline tests for:

- `transformScope: "subtree"` parents attach child scene objects under the parent transform group.
- Parent `ctx.target.setPosition(...)` moves the parent group while child renderables keep their own measured source/effect state.
- A child text target still receives its own effect update under a transformed parent.
- Parent unregister removes the group without disposing still-registered child state directly.
- Targets without `transformScope` keep current flat scene behavior.

### Task 5: Effect Target Semantics

**Files:**

- Modify: `packages/dom-webgl-runtime/src/lib/renderer/targetRuntimeState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify or create helper near:
  - `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Test: `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] For `transformScope: "subtree"` targets, return a tracked effect target backed by the transform group, not only the target's visual object.
- [x] Keep source handles unchanged.
- [x] Preserve effect target disposal behavior.
- [x] Test parent group `setPosition`, `setRotation`, and `setScale` calls.
- [x] Test parent `setVisible(false)` hides the subtree group without disposing child renderables.
- [x] Treat `setOpacity` as best-effort group opacity in v1; test only the non-conflicting case where descendants do not also write opacity.

Focused command:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts packages/dom-webgl-runtime/test/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

### Task 6: Example Dogfood

**Files:**

- Modify: `apps/example/src/App.tsx`
- Modify only if necessary: `apps/example/src/sequenceCardEffect.ts`
- Test: `apps/example/test/App.test.tsx`
- Test: `apps/example/test/sequenceCardEffect.test.ts`

- [x] Set `transformScope: "subtree"` on `example.image-sequence.card`.
- [x] Convert the card title/description into child `dom/text` targets.
- [x] Bind the child `example.textReveal` effects to the pinned
      `example.video.scrub` progress key.
- [x] Keep imports public-only from `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`.
- [x] Prefer `hideMode: "self"` on the parent card so child target fallback ownership stays independent.
- [x] Keep `sequenceCardEffects` stable at module scope.
- [x] Do not hardcode example keys in runtime/package source.

Focused command:

```bash
npm test -- --run apps/example/test/App.test.tsx apps/example/test/sequenceCardEffect.test.ts
npm run check:imports
```

### Task 7: Documentation Sync

**Files:**

- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `AGENTS.md` only if the new API becomes a core usage rule.

- [x] Document `transformScope: "subtree"` as a parent-side transform inheritance capability.
- [x] Show the sequence-card parent/child text example.
- [x] State boundaries:
  - no raw Three.js object/scene/camera/material exposure.
  - no public scene graph API.
  - pointer remains layout/global pointer in v1.
  - lifecycle remains target-scoped.
  - child source/effects/textures remain child-owned.
- [x] Update active status docs with the verified implementation status after tests pass.

Focused command:

```bash
git diff --check
```

### Task 8: Full Verification

Run the project-standard verification sequence:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Result:

- [x] All Vitest tests pass.
- [x] TypeScript passes.
- [x] Build passes for workspaces.
- [x] Example import boundary passes.
- [x] No whitespace errors.

Do not stage or commit unless the user explicitly asks for closeout.

---

## Explicit Non-Goals

- Do not expose raw Three.js `Object3D`, `Scene`, `Camera`, `Material`, `Mesh`, `Group`, or `Texture` in public API.
- Do not add a complete public 3D scene graph.
- Do not add public `parent` or `group` declarations in v1.
- Do not add raycasting, complex picking, or pointer inverse-transform APIs in v1.
- Do not make parent lifecycle own child resource disposal.
- Do not make child DOM automatically become WebGL; only declared child `WebGLTarget`s participate.
- Do not move example-specific keys, assets, layout assumptions, or text into runtime/package code.
- Do not add built-in visual effects to the package.

---

## Execution Notes

- Start every implementation session by re-reading `AGENTS.md`.
- Use CodeGraph before editing runtime symbols.
- Keep tests outside `src/`.
- Use `satisfies` and `@ts-expect-error` for public type boundary tests.
- Use DI/fake scene adapters rather than real GPU contexts in tests.
- If implementation reveals that matrix-correct child target spatial controls under rotated/flipped parents require a larger transform state refactor, keep v1 scoped to inherited parent transforms plus child source/material/text effects, then document the limitation instead of exposing raw Three.js.
