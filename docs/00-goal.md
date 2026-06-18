# DOM-First Interactive WebGL Runtime Goal

Date: 2026-06-16

## Implementation Status Note

The product goal below includes future effect-oriented behavior. Phase 1 is
complete through Task 37. Phase 2 scene-gated scroll is complete through Task
56, including public gate declarations, scroll lock, `sceneProgress`, explicit
reverse gate behavior, demo gate declaration, debug state display,
SSR/import-boundary regressions, full verification, and final documentation
alignment. Phase 3 visible renderables are complete through Task 72: DOM-authored
element snapshots, text snapshots, images, videos, and GLB models now become
runtime-owned visible scene objects, fallback visibility is tied to renderable
readiness, and public/SSR import boundaries remain covered. Phase 3.5 runtime
performance and stage correction is implemented: the canvas is an internal
stage layer, the renderer owns the frame loop, layout reads are batched,
snapshot content rebuilds follow dirty boundaries, target lifecycle state is
reported separately from resource status, and resource/render-target disposal
contracts are covered. Effects remain future work.

## Purpose

Build a new DOM-first interactive WebGL runtime from zero with a clear product model.

It is a runtime that treats normal DOM elements as the authoring model, compiles declared elements and sources into WebGL renderables, and drives them through shared scroll and pointer input inside one renderer.

## One-Sentence Goal

Create a DOM-first interactive WebGL scene runtime where page authors declare ordinary DOM elements and sources, while the runtime compiles them into source descriptors, render roles, renderables, scroll-gated scene progress, pointer interaction state, and one Three.js renderer.

## Core Mental Model

The runtime pipeline is:

```txt
DOM element
  -> target descriptor
  -> source descriptor
  -> renderRole
  -> renderable
  -> runtime-owned scene object
  -> single renderer
```

The authoring model is DOM. WebGL is the compiled visual runtime.

Page authors should think about:

- Which DOM element enters WebGL.
- What source that element represents.
- Where it sits in the DOM tree and source order.
- Whether it follows page scroll or participates in a gated scene.
- Whether pointer input should affect it.

Page authors should not think about:

- Three.js `renderOrder`.
- Three.js `transparent`.
- Three.js `depthWrite`.
- Internal scene objects.
- DOM rect projection.
- Renderer adapters.
- Renderer pass order.
- Multiple WebGL canvases.
- Effects that scan DOM or own separate resource pipelines.

## Declarative Authoring Contract

A target is an ordinary DOM element plus one `WebGLDeclaration` object.

The public API should group all WebGL-specific configuration under one declaration object instead of spreading it across many component props or DOM attributes.

```ts
type WebGLDeclaration = {
  key: string;
  source?: WebGLSourceDeclaration;
  renderRole?: WebGLRenderRole;
  scroll?: WebGLScrollBehavior;
  pointer?: WebGLPointerDeclaration;
  lifecycle?: WebGLLifecycleDeclaration;
};

type WebGLLifecycleDeclaration = {
  hideWhenReady?: boolean;
  hideMode?: "subtree" | "self";
};
```

React usage:

```tsx
<WebGLTarget
  as="div"
  webgl={{
    key: "hero.model",
    source: { kind: "model", format: "glb", src: "/models/hero.glb" },
    renderRole: "model",
    scroll: { type: "gate", start: "top top", duration: 1 },
    pointer: { move: true, click: true, drag: true },
    lifecycle: { hideWhenReady: true }
  }}
/>
```

Vanilla usage:

```ts
registerWebGLTarget(element, {
  key: "hero.model",
  source: { kind: "model", format: "glb", src: "/models/hero.glb" },
  renderRole: "model",
  scroll: { type: "gate", start: "top top", duration: 1 },
  pointer: { drag: true }
});
```

The declaration describes what the target means. It does not describe how Three.js should render it.

Allowed declarations:

- Stable key.
- Source.
- Optional `renderRole` override.
- Scroll behavior.
- Pointer behavior.
- Lifecycle and fallback behavior.

Disallowed declarations:

- Three.js `renderOrder`.
- Three.js `transparent`.
- Three.js `depthWrite`.
- Internal scene object ownership.
- DOM projection details.
- Scene adapter details.
- Internal render ordering types.
- Renderer pass details.
- Canvas layer details.
- Effect-owned resource pipelines.

The same declaration schema should be usable by React, vanilla DOM registration, and future framework adapters.

## API Simplicity Principle

The public API should minimize user decisions. Common cases should work with only a key and, when needed, a source.

Minimal target:

```tsx
<WebGLTarget as="div" webgl={{ key: "hero.surface" }} />
```

Minimal model target:

```tsx
<WebGLTarget
  as="div"
  webgl={{
    key: "hero.model",
    source: { kind: "model", format: "glb", src: "/models/hero.glb" }
  }}
/>
```

The runtime should infer defaults for:

- Source kind when it is obvious from the DOM element.
- `renderRole` from source kind.
- Page scroll behavior.
- Pointer state collection.
- Render policy.
- Visibility/update/dispose lifecycle.

Users should only configure advanced fields when they need to override a real behavior:

- Set `renderRole` only when source inference is insufficient.
- Set `scroll` only when using scene gates or custom scroll ranges.
- Set `pointer` only when an interaction requires click, press, long press, or drag semantics.
- Set `lifecycle` only when fallback behavior differs from the default.

Avoid API shapes that require users to understand internal runtime stages. The declaration object is a product-facing schema, not a mirror of implementation modules.

## Important Naming Decisions

Use `renderRole`, not `layerIntent`.

Use DOM element language throughout the runtime.

Good runtime terms:

- `DOM element`
- `target descriptor`
- `source descriptor`
- `renderRole`
- `render policy`
- `renderable`
- `scene gate`
- `pointer state`

Avoid runtime concepts such as:

- `cut index`
- `asset layer`

## Render Contract

### Target Descriptor

A target descriptor is the normalized runtime representation of a DOM element that opted into WebGL.

It should include:

- Stable id/key.
- DOM element reference.
- DOM scan order.
- The resolved `WebGLDeclaration`.

### Source Descriptor

A source descriptor describes what visual source the DOM element contributes.

Initial source kinds:

```ts
type WebGLSourceDescriptor =
  | { kind: "snapshot"; mode: "element"; element: HTMLElement }
  | { kind: "snapshot"; mode: "text"; element: HTMLElement }
  | { kind: "image"; element: HTMLImageElement; src: string }
  | { kind: "video"; element: HTMLVideoElement; src: string }
  | { kind: "model"; format: "glb"; anchor: HTMLElement; src: string };
```

The runtime may infer these from DOM tag, explicit source props, or explicit source type. The explicit declaration should override inference.

### Render Role

`renderRole` is the runtime semantic role used to compile a DOM/source into WebGL render policy.

```ts
type WebGLRenderRole =
  | "surface"
  | "content"
  | "media"
  | "model"
  | "overlay";
```

Role meanings:

- `surface`: the element's own visual surface, such as box paint, background, border, or an element snapshot.
- `content`: text-like or content-like snapshots.
- `media`: image and video sources.
- `model`: GLB or future 3D sources.
- `overlay`: explicitly foreground visual effects.

Default role inference:

```txt
snapshot/element -> surface
snapshot/text    -> content
image/video      -> media
model/glb        -> model
explicit effect  -> overlay
```

`renderRole` compiles to Three.js policy. Page code should not set low-level Three.js ordering flags.

Example policy direction:

```txt
surface -> lower render band, opaque when possible, no depth write for flat planes
content -> above surface, transparent only when needed
media   -> media band, source-specific transparency
model   -> model band, normal 3D depth within the model
overlay -> highest controlled band
```

Delivered Phase 3 behavior:

- Element snapshot targets create visible runtime-owned scene planes.
- Text snapshot targets create visible runtime-owned scene planes.
- Image targets create visible runtime-owned image scene planes.
- Video targets create visible runtime-owned video scene planes.
- GLB model targets create visible runtime-owned model scene objects.
- DOM rects are projected into scene coordinates internally.
- Ordering comes from `renderRole` through internal render policy, not public
  Three.js flags.
- Mounted React runtimes create and dispose the runtime but do not own a frame
  loop.
- The runtime owns a renderer-driven loop through the renderer host and renders
  visible scene changes through the single scene adapter.
- Layout reads are batched before renderables receive layout updates.
- Async resource completion requests a render after the visual scene object is
  ready.

## Scroll Contract

The runtime must support two kinds of scroll behavior.

### Page Scroll

Normal page scrolling continues. DOM layout changes, viewport measurements update, and WebGL renderables follow their DOM anchors.

### Scene-Gated Scroll

At specific DOM anchors, page scroll can temporarily stop. During the gate, wheel/touch scroll input drives the current scene animation instead of moving the page. When the scene animation completes, the runtime releases page scrolling.

Mental model:

```txt
scroll input
  -> page scroll
  OR
  -> gated scene progress
  -> release back to page scroll
```

Delivered Phase 2 API shape:

```ts
type WebGLScrollBehavior =
  | { type?: "page" }
  | {
      type: "gate";
      start: string;
      duration: number;
      release?: "forward-complete" | "both-directions-complete";
    };
```

Required behavior:

- Enter gate when the declared anchor reaches its start condition.
- Lock page scroll while the gate is active.
- Convert scroll delta into `sceneProgress` from `0` to `1`.
- Release page scroll when the gate completes.
- Default omitted `release` to `"forward-complete"`.
- Support reverse direction deliberately through
  `release: "both-directions-complete"`.
- Avoid coupling this behavior to any specific renderRole.

## Pointer Contract

Pointer input is a shared runtime input source. Renderables, scene gates, and future effects consume normalized pointer state instead of adding their own global listeners.

The runtime should use Pointer Events as the unified base for mouse, pen, and touch.

Supported interaction semantics:

```ts
type PointerInteraction =
  | "move"
  | "hover"
  | "click"
  | "press"
  | "longPress"
  | "drag";
```

The runtime should maintain frame-readable pointer state:

```ts
type WebGLPointerState = {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  isInside: boolean;
  isDown: boolean;
  downTime: number;
  pressDuration: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragDeltaX: number;
  dragDeltaY: number;
  lastClickTime?: number;
  clickCount: number;
};
```

Pointer ownership rules:

- The runtime owns global pointer listeners.
- Renderables do not attach their own window-level listeners.
- Hit testing may use DOM anchors, WebGL raycasting, or both, but the result enters one interaction state model.
- Pointer state is available to scene animation and future effects through the frame input.

## Frame Input Contract

Animation code should receive one normalized frame input instead of reading DOM, scroll, pointer, and time separately.

```ts
type WebGLFrameInput = {
  time: number;
  delta: number;
  scroll:
    | {
        mode: "page";
        pageProgress: number;
        direction: -1 | 0 | 1;
        velocity: number;
      }
    | {
        mode: "gate";
        sceneProgress: number;
        activeGateKey: string;
        direction: -1 | 0 | 1;
        velocity: number;
      };
  pointer: WebGLPointerState;
};
```

Future effects and scene animation consume this frame input plus runtime-owned renderables.

## Runtime Ownership

The runtime owns:

- DOM scanning.
- Target descriptor creation.
- Source descriptor creation.
- Render role inference.
- Render policy compilation.
- Base renderable creation.
- Runtime-owned scene object creation, layout updates, visibility, and disposal.
- DOM rect projection into scene layout.
- Internal render policy ordering.
- One Three.js renderer and canvas.
- Scroll input routing.
- Scene gate state.
- Pointer input state.
- Resize, visibility, update, and disposal lifecycle.
- Debug state.

The page owns:

- Semantic DOM.
- Content.
- Source paths.
- Visual fallback markup.
- High-level declarations.
- App-specific composition.

## Package Boundary

The core runtime should be built as a reusable library first, with the demo project consuming only exported APIs.

Use a monorepo workspace so the runtime package and demo app can evolve together while keeping package boundaries explicit.

Project shape:

```txt
dom-webgl-workspace/
  package.json
packages/dom-webgl-runtime/
  src/
    lib/
      dom/
      source/
      render/
      input/
      renderer/
      react/
      index.ts
  package.json

apps/demo/
  app/
  components/
  public/
```

Root workspace direction:

```json
{
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

All core capabilities live under the package `src/lib/` tree. Demo code must not import package internals by file path. It should import only from public package exports.

Public API examples:

```ts
import {
  WebGLRuntime,
  WebGLTarget,
  createWebGLRuntime,
  type WebGLRenderRole,
  type WebGLScrollBehavior,
  type WebGLPointerState,
  type WebGLFrameInput
} from "@project/dom-webgl-runtime";
```

The library owns:

- DOM scanning and target descriptors.
- Source descriptor inference.
- `renderRole` inference and render policy compilation.
- Base renderable creation.
- Runtime-owned visible scene objects.
- DOM rect projection and internal render ordering.
- Scroll controller and scene gates.
- Pointer controller.
- Renderer loop.
- React adapters.
- Public types.

The demo owns:

- Example DOM structure.
- Content and assets.
- Demo-specific styling.
- Demo scenes that exercise the public API.

Boundary rules:

- `apps/demo/*` may import from `@project/dom-webgl-runtime`.
- `apps/demo/*` must not import from `@project/dom-webgl-runtime/src/lib/*`.
- `packages/dom-webgl-runtime/src/lib/*` must not import app/demo code.
- Public exports should be intentionally small and stable.
- Internal modules can change freely as long as public API tests pass.

## Package Consumption Sketch

Develop the runtime as a workspace package first. The demo should consume it the same way a real app would.

Workspace shape:

```txt
packages/dom-webgl-runtime
apps/demo
```

React demo import:

```ts
import { WebGLRuntime, WebGLTarget } from "@project/dom-webgl-runtime/react";
```

Vanilla import:

```ts
import {
  createWebGLRuntime,
  registerWebGLTarget
} from "@project/dom-webgl-runtime";
```

Public export direction:

```ts
// @project/dom-webgl-runtime
export { createWebGLRuntime, registerWebGLTarget, unregisterWebGLTarget };
export type {
  WebGLDeclaration,
  WebGLRenderRole,
  WebGLScrollBehavior,
  WebGLPointerDeclaration,
  WebGLLifecycleDeclaration,
  WebGLDebugState
};

// @project/dom-webgl-runtime/react
export { WebGLRuntime, WebGLTarget, useWebGLRuntime };
```

Do not use persistent `npm link` for normal development. Workspace dependencies should be enough.

## Client And SSR Boundary

The package should be safe to import in SSR environments, but browser runtime work is client-only.

SSR-safe exports:

- Types.
- Declaration schemas.
- Pure validation helpers.
- Pure defaulting/inference helpers that do not touch DOM globals.

Client-only exports:

- DOM scanning.
- Renderer creation.
- Runtime mount/start.
- Pointer controller.
- Scroll controller.
- Scene gate controller.
- Asset loading that relies on browser APIs.

Rules:

- Do not touch `window`, `document`, `HTMLElement`, canvas, or WebGL at module import time.
- React runtime components that mount WebGL should be client components.
- The package should fail visibly if a client-only runtime API is executed without a browser environment.
- Demo code should keep runtime mounting behind a client boundary.

## Error, Loading, And Fallback Contract

Source and renderable lifecycle must be explicit. Silent failures are not acceptable.

Renderable state should distinguish:

```ts
type WebGLResourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";
```

Every target should expose enough state to answer:

- Has the source descriptor resolved?
- Is the visual resource loading?
- Is the visual resource ready?
- Did loading fail?
- Is the DOM fallback still visible?
- Is the WebGL renderable currently visible?

Initial error behavior:

- If image/video/model loading fails, keep the DOM fallback visible.
- If snapshot creation fails, keep the DOM element visible.
- If WebGL is unavailable, the page remains usable as DOM.
- Errors are reported through a runtime callback and debug state.

Candidate runtime callbacks:

```ts
type WebGLRuntimeEvents = {
  onReady?(target: WebGLTargetState): void;
  onError?(error: WebGLRuntimeError): void;
  onDebugStateChange?(state: WebGLDebugState): void;
};
```

`hideWhenReady` and related lifecycle options must only hide fallback visuals
after the matching WebGL scene object is visually ready.

Delivered fallback visibility behavior:

- Loading renderables keep the DOM fallback visible.
- Failed renderables keep the DOM fallback visible.
- `hideWhenReady: true` hides fallback only after visual scene object readiness.
- `hideMode: "subtree"` hides the target and descendants after readiness.
- `hideMode: "self"` hides only the target element's own fallback paint and
  preserves child DOM visibility.
- Target unregister and runtime disposal restore fallback visibility.

## DOM To WebGL Performance Contract

DOM is the source of truth, but it is not a per-frame rasterization source.

Rules:

- DOM scan happens on mount, explicit sync, or observed structure changes. It must not run as a full-tree scan every frame.
- DOM measurement may happen every frame, but it must be batched in one runtime layout pass.
- Renderables must not perform scattered layout reads independently.
- Element and text snapshots must not be rebuilt every frame.
- Snapshot resources are rebuilt only after content, size, style, device pixel ratio, or explicit invalidation changes.
- Image, video, and model resources are keyed by source URL and cached.
- The same image/video/model source should not download multiple times for multiple targets.
- Hidden or offscreen targets should avoid high-cost update work.
- First paint should not wait for every declared source to load.
- The runtime should expose warnings or debug state when target count, snapshot count, texture memory, or active model count exceeds configured budgets.

Suggested first-version budgets:

```ts
type WebGLPerformanceBudget = {
  maxActiveSnapshots: number;
  maxActiveVideos: number;
  maxActiveModels: number;
  maxTextureSize: number;
  maxConcurrentResourceLoads: number;
};
```

Default budgets should be conservative and observable. They should warn in development before they silently degrade runtime performance.

## Viewport-Based Performance Contract

Targets should move through lifecycle ranges based on viewport proximity. The runtime should avoid treating every declared target as equally active.

Viewport ranges:

```ts
type WebGLViewportLifecycleRange = {
  preloadMargin: string;
  mountMargin: string;
  activeMargin: string;
  unloadMargin: string;
};
```

Suggested defaults:

```ts
const defaultViewportLifecycle = {
  preloadMargin: "150vh",
  mountMargin: "100vh",
  activeMargin: "50vh",
  unloadMargin: "250vh"
} satisfies WebGLViewportLifecycleRange;
```

Range behavior:

- Outside `unloadMargin`: resource may be unloaded or retained only by cache policy.
- Inside `preloadMargin`: source acquisition may begin.
- Inside `mountMargin`: GPU resources may be created and registered.
- Inside `activeMargin`: normal frame updates are allowed.
- Actually visible in viewport: renderable visibility can become true.
- Outside `activeMargin` but inside `unloadMargin`: retain resources when useful, but skip high-cost per-frame work.

Rules:

- Fast scroll may skip intermediate states, but it must not skip cleanup.
- Scene gates may raise nearby target priority.
- Hidden/offscreen targets should not rebuild snapshots or run expensive animation updates.
- Debug state should expose each target's current lifecycle range.

## Runtime Lifecycle Contract

Base renderables are the primary lifecycle unit. Effects should consume this lifecycle later instead of owning an unrelated lifecycle model.

Lifecycle states:

```ts
type WebGLLifecycleState =
  | "declared"
  | "preloading"
  | "loaded"
  | "mounted"
  | "active"
  | "inactive"
  | "paused"
  | "disposed"
  | "error";
```

Lifecycle flow:

```txt
declare
  -> preload
  -> load
  -> mount
  -> activate
  -> update
  -> deactivate / pause / resume
  -> dispose
```

State meanings:

- `declared`: target descriptor exists; no expensive resource work has to start yet.
- `preloading`: runtime has scheduled a source load before activation.
- `loaded`: external source or snapshot resource is ready outside the scene.
- `mounted`: GPU resources and renderable exist and are registered with the renderer.
- `active`: target is in an active viewport/gate/interaction range and receives normal frame updates.
- `inactive`: resource may be retained, but high-cost frame work is skipped.
- `paused`: runtime loop or target update is temporarily paused because of tab visibility, route transition, manual pause, or reduced motion.
- `disposed`: CPU/GPU resources, event hooks, and loader references are released.
- `error`: loading or mount failed; DOM fallback remains visible.

Lifecycle declaration should stay simple:

```ts
type WebGLLifecycleDeclaration = {
  preload?: "none" | "viewport" | "eager";
  activation?: "viewport" | "manual";
  unload?: "never" | "offscreen" | "dispose";
  hideWhenReady?: boolean;
};
```

Defaults:

```ts
const defaultLifecycle = {
  preload: "viewport",
  activation: "viewport",
  unload: "offscreen",
  hideWhenReady: false
} satisfies WebGLLifecycleDeclaration;
```

Lifecycle rules:

- Preload is not mount.
- Pause is not dispose.
- Inactive is not unloaded.
- Runtime unmount and route change must dispose.
- Dispose must be idempotent.
- Tab hidden should pause or reduce the renderer loop.
- Scene gate interruption must always release scroll lock.
- Resource unload must release GPU resources, not only remove scene objects.
- Fallback hiding can only happen after the target reaches a ready visual state.

## Resource Loading And Unloading Contract

External resources must go through a shared resource manager. Renderables should not fetch, decode, or cache resources independently.

Resource acquisition is not always the same as downloading. For DOM-native media, the browser often owns the network request first; the runtime should reuse that source by default instead of downloading it again.

Resource types:

```ts
type WebGLResourceKind =
  | "snapshot"
  | "image"
  | "video"
  | "model/glb";
```

Resource state:

```ts
type WebGLResourceRecord = {
  key: string;
  kind: WebGLResourceKind;
  url?: string;
  status: WebGLResourceStatus;
  refCount: number;
  error?: string;
  load(): Promise<void>;
  dispose(): void;
};
```

General loading rules:

- All resource acquisition goes through a resource manager with concurrency limits.
- Resource cache keys must include kind and normalized URL or snapshot invalidation key.
- Multiple targets using the same URL share the same resource record.
- Resource records use reference counting or an equivalent ownership model.
- Failed resources remain inspectable through debug state.
- Retrying a failed resource should be explicit.
- The runtime should support custom resolvers so apps can integrate CDNs, auth, or bundled assets later.
- Prefer adopting existing DOM resources over issuing duplicate network requests.

Image loading:

- If the target is an `HTMLImageElement`, prefer its existing `currentSrc`/decoded element.
- Use `HTMLImageElement.decode()` or equivalent browser decode where available.
- Do not fetch the same image URL again just to create a texture.
- Create one texture per cached image resource or shared decoded image.
- Apply max texture size constraints.
- Dispose texture when the resource record is no longer retained.

Video loading:

- If the target is an `HTMLVideoElement`, prefer its existing media element and browser-managed loading pipeline.
- Do not create a second hidden video element unless the declaration explicitly uses a non-DOM source.
- Treat the video element or media source as a long-lived resource.
- Create `THREE.VideoTexture` only after metadata or enough data is available.
- Pause video when target is inactive or runtime is paused unless explicitly configured otherwise.
- Remove source/object references and dispose texture on unload.
- Keep autoplay/muted/playsInline behavior explicit.

GLB loading:

- GLB is not a DOM-native media element in the same way as image/video, so the runtime usually resolves and loads it through the shared resource manager.
- If a custom app resolver has already loaded or cached the GLB, reuse that result instead of fetching the URL again.
- Parse with a single loader path.
- Cache parsed source results when safe, but clone scene instances per renderable if mutation would otherwise leak between targets.
- Dispose geometries, materials, textures, skeleton-related resources, and scene references on unload.
- Report parse, fetch, and asset resolution failures separately when possible.

Snapshot loading:

- Snapshot creation is a resource build step, not a frame update step.
- Snapshot invalidation should be explicit or driven by observed content/size/style changes.
- Snapshot canvas and texture must be disposed on rebuild and unload.

## Hit Testing Scope

Pointer support requires a clear first-version hit testing boundary.

First milestone:

- Use DOM-anchor hit testing.
- A pointer is considered related to a target when it intersects the target element's DOM rect.
- Drag/click/press semantics can attach to a target through its DOM anchor.

Deferred:

- WebGL raycast picking.
- Mesh-level interaction.
- Per-triangle or material-level interaction.
- Mixed DOM and raycast arbitration.

This keeps pointer interactions useful without forcing the first runtime to solve 3D picking.

## Scroll Gate Browser Boundary

Scene-gated scroll must define browser behavior explicitly.

Required first-version rules:

- Normalize wheel and touch delta into gate progress.
- Lock page scroll only while a gate is active.
- Always release the lock on gate completion, runtime disposal, route change, visibility loss, or fatal runtime error.
- Avoid trapping the user inside a gate.
- Respect reduced motion by skipping or shortening gated scene animation.
- Treat reverse direction as an explicit behavior, not a side effect.

Open implementation choice for the first project:

- Prefer a small internal scroll controller before adopting a third-party scroll library.
- Add an adapter later if Lenis, GSAP ScrollTrigger, or another scroll system is required by a demo.

## Debug And Validation Contract

The runtime should expose a lightweight debug state from the first milestone.

Suggested shape:

```ts
type WebGLDebugState = {
  targetCount: number;
  renderableCount: number;
  currentScrollMode: "page" | "gate";
  activeGateKey?: string;
  sceneProgress?: number;
  pointer: WebGLPointerState;
  targets: Array<{
    key: string;
    sourceKind: string;
    renderRole: WebGLRenderRole;
    resourceStatus: WebGLResourceStatus;
    visible: boolean;
    error?: string;
  }>;
};
```

Validation should prove:

- Demo imports only public package exports.
- Browser-only runtime APIs are not executed during SSR.
- Failed assets keep DOM fallback visible.
- Surface/content/media/model roles render in stable order.
- Scene gates release page scroll.
- Pointer drag/click state can be inspected through debug state.

## Module Shape For A New Implementation

Recommended starting modules:

```txt
src/lib/dom/
  scanTargets.ts
  targetDescriptor.ts

src/lib/source/
  sourceDescriptor.ts
  inferSource.ts

src/lib/render/
  renderRole.ts
  renderPolicy.ts
  renderable.ts
  renderables/
    snapshotRenderable.ts
    imageRenderable.ts
    videoRenderable.ts
    modelRenderable.ts

src/lib/input/
  scrollController.ts
  sceneGate.ts
  pointerController.ts
  frameInput.ts

src/lib/renderer/
  rendererLoop.ts
  runtime.ts

src/lib/react/
  WebGLTarget.tsx
  WebGLRuntime.tsx

src/lib/index.ts
```

Keep the first implementation small. The initial runtime should prove the straight pipeline before adding a general effect system.

## First Milestone

Build the base runtime package with no effect system, then build a demo that consumes the package exports.

Must support:

- Package-level public exports.
- DOM target scanning.
- Explicit keys.
- Element snapshot renderables.
- Text snapshot renderables.
- Image renderables.
- Video renderables.
- GLB model renderables.
- `renderRole` inference.
- Render policy compilation.
- Single renderer.
- Shared frame input.
- Basic page scroll mode.
- Basic pointer move/click/drag state.

Success criteria:

- A page can declare normal DOM elements and sources.
- The runtime creates renderables through one pipeline.
- Surface/content/media/model roles render in predictable order.
- A GLB anchored to a DOM element is not hidden by an element surface snapshot.
- Renderables update from DOM measurements and dispose cleanly.
- The demo imports only from the package public API.

## Second Milestone

Add scene-gated scroll.

Must support:

- Entering a gate from page scroll.
- Locking page scroll while active.
- Mapping wheel/touch delta to `sceneProgress`.
- Releasing page scroll after completion.
- Reverse-direction behavior with explicit rules.
- Tests for gate entry, progress, completion, and release.

## Third Milestone

Add the first animation/effect layer.

Only after base renderables, render roles, scroll gates, and pointer state are stable, introduce effects as consumers of runtime-owned objects.

Effect rules:

- Effects consume target descriptors, renderables, frame input, and pointer/scroll state.
- Effects do not scan DOM.
- Effects do not create separate renderers.
- Effects do not create independent asset pipelines.
- Effects must declare what render roles or source kinds they can consume.

## Non-Goals For The New Project

- Do not create multiple WebGL canvases to solve ordering.
- Do not expose Three.js ordering flags as the main page API.
- Do not start with a general-purpose effect registry.
- Do not port archived effect implementations first.
- Do not use class-based effect compatibility layers.
- Do not let every renderable or effect own its own pointer listeners.
- Do not let scroll behavior, render role, and pointer behavior collapse into one mixed abstraction.

## Architecture Principles

1. DOM is the authoring model.
2. WebGL is the compiled visual runtime.
3. `renderRole` is the semantic bridge between source and render policy.
4. Public API defaults should cover common cases with minimal configuration.
5. Scroll input can either move the page or drive a gated scene.
6. Pointer input is shared runtime state.
7. Effects come after the base path and consume runtime-owned objects.
8. One renderer owns visual output.
9. Keep page semantics out of core runtime.
10. Prefer explicit internal contracts over historical compatibility.
11. Optimize for a straight path a new maintainer can understand quickly.
