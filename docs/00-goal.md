# DOM-First Interactive WebGL Runtime Goal

Date: 2026-06-16

## Implementation Status Note

The product goal below includes future effect-oriented behavior. Phase 1 is
complete through Task 37. Phase 2 scene-gated scroll is complete through Task
56, including public gate declarations, scroll lock, `sceneProgress`, explicit
reverse gate behavior, debug state display,
SSR/import-boundary regressions, full verification, and final documentation
alignment. Phase 3 visible renderables are complete through Task 72: DOM-authored
element snapshots, text snapshots, images, videos, and GLB models now become
runtime-owned visible scene objects, fallback visibility is tied to renderable
readiness, and public/SSR import boundaries remain covered. Phase 3.5 runtime
performance and stage correction is implemented: the canvas is a fixed
transparent internal viewport stage layer, the renderer owns the frame loop,
layout reads are batched, snapshot content rebuilds follow dirty boundaries,
target lifecycle state is reported separately from resource status, and
resource/render-target disposal contracts are covered. Phase 4 is now narrowed
to DOM layout/content mapping: layout snapshots, cached renderer resize, dirty
DOM invalidation, placement-only style snapshots, transparent element anchors,
text placement/raster sizing, media content-box object-fit mapping, and a
public-API-only responsive demo harness are in place. The forward direction is
not to expand CSS fidelity. DOM supplies layout, content, accessibility, and
interaction state; WebGL effects/materials should own final visual styling.
Phase 5 adds the first public minimum effect/material layer with built-in
`solid` material and `pointer-tilt` motion declarations. General custom effect
registration, shader authoring, particles, picking, third-party scroll adapters,
multiple canvases, and public Three.js render flags remain future work.
Phase 6.1 modularizes the Phase 5 effect layer without changing public API or
visible behavior: pure effect normalization, compatibility, target capability
types, and pointer motion are separated from Three.js renderable target
adapters. Phase 6.2 adds a minimal built-in `surface` material for
declaration-owned element snapshot color, opacity, and radius. Phase 7
preserves Phase 6 declarations while moving effect execution from fixed
material/motion slots to ordered, registry-driven runtime primitives.

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
  -> layout/content snapshot
  -> renderRole
  -> renderable
  -> effect/material policy
  -> runtime-owned scene object
  -> single renderer
```

The authoring model is DOM. DOM is the source for layout, content,
accessibility, and interaction state. WebGL is the compiled visual runtime and
effects/materials are the source for final visual styling. Only declared targets
enter WebGL; ordinary undeclared DOM remains visible, native, and interactive.

The runtime should know enough DOM information to place and populate WebGL
objects:

- Border-box and content-box position and size.
- Text content, media sources, model sources, and resource metadata.
- DOM/source ordering and lifecycle state.
- Scroll, pointer, visibility, and interaction state.
- Minimal style data when it changes content placement, such as padding,
  object-fit/object-position, font metrics, line height, and text alignment.

The runtime should not treat browser CSS as the visual truth for WebGL. General
backgrounds, borders, radii, shadows, gradients, filters, blend modes, masks,
decorative opacity, and material appearance should be declared or selected by
the WebGL effect/material layer. The former Phase 4 CSS box renderer has been
removed from the active runtime path; it is historical context, not a
compatibility foundation to preserve.

Declared targets default to WebGL visual replacement: once the WebGL scene
object is visually ready, the target's own fallback paint is hidden with
`hideMode: "self"`. Authors opt out with `hideWhenReady: false` or explicitly
request subtree replacement with `hideMode: "subtree"`.

The runtime inserts the fixed WebGL canvas before author DOM in its container.
That canvas-first structure lets undeclared DOM and `hideWhenReady: false`
targets remain visually native without a global wrapper layer, while the canvas
stays pointer-transparent. The canvas is explicitly stacked below direct author
DOM children (`z-index: 0` canvas, `z-index: 1` DOM children), because DOM order
alone does not put a fixed-position canvas below normal-flow DOM.

Page authors should think about:

- Which DOM element enters WebGL.
- What source that element represents.
- Where it sits in the DOM tree and source order.
- Whether it follows page scroll or participates in a gated scene.
- Whether pointer input should affect it.
- Which effect or material should own its WebGL visual treatment once the
  effect layer exists.

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
- Matching arbitrary CSS visual paint in WebGL.

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
  effects?: WebGLEffectsDeclaration;
};

type WebGLLifecycleDeclaration = {
  hideWhenReady?: boolean;
  hideMode?: "subtree" | "self";
};

type WebGLEffectsDeclaration = {
  material?: WebGLMaterialDeclaration;
  motion?: WebGLMotionDeclaration;
};

type WebGLMaterialDeclaration =
  | {
      kind: "solid";
      color?: number;
      opacity?: number;
    }
  | {
      kind: "surface";
      color?: number;
      opacity?: number;
      radius?: number;
    };

type WebGLMotionDeclaration = {
  kind: "pointer-tilt";
  strength?: number;
  maxDegrees?: number;
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
    pointer: { move: true, click: true, drag: true }
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
- Built-in effect/material declarations.

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
- Custom effect callbacks or registries.

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

- `surface`: a DOM-anchored visual surface. It is positioned by the DOM box, but
  its final visual treatment should come from WebGL material/effect policy
  rather than arbitrary CSS paint.
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
- Text snapshot targets create visible runtime-owned scene planes sized from
  the measured DOM text box with computed text style applied to the internal
  text canvas.
- Image targets create visible runtime-owned image scene planes.
- Video targets create visible runtime-owned video scene planes.
- GLB model targets create visible runtime-owned model scene objects. Model
  layout reads the loaded `Object3D` bounds once and contains those bounds inside
  the DOM anchor rect with a uniform XYZ scale.
- The default renderer scene includes a small ambient plus directional light rig
  so lit GLB/PBR materials have baseline visibility without demo-specific
  branches.
- DOM rects are projected into scene coordinates internally.
- Ordering comes from `renderRole` through internal render policy, not public
  Three.js flags.
- Mounted React runtimes create and dispose the runtime but do not own a frame
  loop.
- The runtime owns a renderer-driven loop through the renderer host and renders
  visible scene changes through the single scene adapter.
- The fixed viewport canvas and orthographic camera use the canvas's actual
  rendered CSS box as their shared CSS-pixel coordinate space, so scrollbar
  gutters and fixed-stage sizing do not drift away from
  `getBoundingClientRect()` anchors.
- The default demo keeps ordinary page scroll and does not enable a scene gate;
  gate behavior is covered by dedicated runtime, React adapter, and public type
  tests.
- Layout reads are batched before renderables receive layout updates.
- Async resource completion requests a render after the visual scene object is
  ready.

## DOM Layout, Content, And Responsive Mapping Contract

DOM remains the authoring, layout, content, accessibility, and interaction
source of truth. WebGL renderables should track DOM anchors closely enough that
targets do not visibly drift from their DOM layout during normal page scroll,
window resize, DPR changes, or mobile layout changes.

Phase 4 introduced a shared layout/style snapshot contract:

```ts
type DOMStyleSnapshot = {
  box: DOMBoxStyleSnapshot;
  text: DOMTextStyleSnapshot;
  media: DOMMediaStyleSnapshot;
  rasterSignature: string;
};

type ElementLayoutSnapshot = ElementMeasurement & {
  viewport: DOMViewportSize;
  devicePixelRatio: number;
  layoutSignature: string;
};
```

Forward mapping rules:

- One runtime layout pass should read rect, viewport size, capped DPR, and
  geometry signatures for active targets.
- Computed style reads should be limited to layout/content placement fields.
  Later DOM CSS visual changes are intentionally not the styling model; layout,
  size, DPR, content, resource, and explicit effect/material boundaries remain
  active.
- Position and size projection should preserve CSS-pixel fractional values until
  the final scene object update.
- Renderer size, DPR, and orthographic camera projection should update on
  window resize, visual viewport changes, orientation changes, and manual sync,
  but should not reconfigure every frame if nothing changed.
- Element snapshots are transparent DOM anchors for effects/materials. They
  should not clone CSS box paint.
- Text snapshots should consume only text placement and rasterization inputs:
  font, line height, padding, alignment, content, and DPR-aware canvas
  sizing.
- Image and video renderables should place the media texture plane in the CSS
  content box and respect common `object-fit` / `object-position` behavior
  within that content box. They should not keep a CSS-painted backing plane.
- Snapshot rebuilds should happen after content, size, capped DPR, or
  explicit invalidation changes, not every frame, and pure position changes
  should not trigger texture rebuilds.
- Unsupported CSS visual features should not be chased one-by-one. They should
  either remain native DOM fallback or move into explicit WebGL effects/materials.

Phase 4's CSS paint compatibility path has been narrowed back out of the active
runtime contract. The active contract keeps DOM layout/content placement fields:
display/visibility lifecycle state, padding and border widths when they affect
content boxes, text font/line-height/alignment, and media object fit/position.
Opacity, background color, border colors, border radius, shadows, text color,
transforms, gradients, filters, backdrop filters, blend modes, masks, clip
paths, and full DOM subtree rasterization are not runtime styling truth. Prefer
DOM layout/content mapping plus effect/material declarations for final visuals.

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
- Runtime pointer coordinates are normalized against the fixed viewport WebGL
  stage, not the `WebGLRuntime` container's document-flow box.
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
- Runtime/package implementation must not hardcode demo-only keys, asset paths,
  DOM structure, layout, or copy. Demo needs must be expressed as reusable
  declarations, public API, or generic internal pipeline behavior.
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
- Declared WebGL targets default to `hideWhenReady: true` and
  `hideMode: "self"`.
- `hideWhenReady: false` keeps the DOM fallback visible.
- Fallback hiding only happens after visual scene object readiness.
- `hideMode: "subtree"` explicitly hides the target and descendants after
  readiness.
- `hideMode: "self"` hides only the target element's own fallback paint and
  preserves ordinary child DOM visibility without overriding nested WebGL
  targets that already own fallback visibility.
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
  hideMode?: "subtree" | "self";
};
```

Defaults:

```ts
const defaultLifecycle = {
  preload: "viewport",
  activation: "viewport",
  unload: "offscreen",
  hideWhenReady: true,
  hideMode: "self"
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
- Use model bounds to fit each scene instance into its DOM anchor with uniform
  scaling; do not map model root scale directly to DOM width/height/depth.
- Dispose geometries, materials, textures, skeleton-related resources, and scene references on unload.
- Report parse, fetch, and asset resolution failures separately when possible.

Snapshot loading:

- Snapshot creation is a resource build step, not a frame update step.
- Snapshot invalidation should be explicit or driven by observed content, size,
  DPR, or resource changes. Computed CSS is captured initially; later
  `style`/`class` mutation tracking is intentionally out of scope for this
  phase.
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

Only after base renderables, render roles, scroll gates, pointer state, and
layout/content mapping are stable, introduce effects as consumers of
runtime-owned objects. This is the main path for WebGL visual styling.

Effect rules:

- Effects consume target descriptors, layout/content snapshots, renderables,
  frame input, and pointer/scroll state.
- Effects do not scan DOM.
- Effects do not create separate renderers.
- Effects do not create independent asset pipelines.
- Effects must declare what render roles or source kinds they can consume.
- Effects/materials own visual styling such as backgrounds, borders, shadows,
  gradients, transitions, deformations, particles, and shader-driven appearance.
- Effects must not depend on arbitrary browser CSS paint matching.

Delivered Phase 5 behavior:

- Public declarations support `effects.material: { kind: "solid" }` for
  explicit WebGL-owned element snapshot surfaces.
- Public declarations support `effects.motion: { kind: "pointer-tilt" }` for
  small pointer-driven target rotation from shared frame input.
- Effect controllers are target-scoped and consume renderables, layout snapshots,
  and `WebGLFrameInput`.
- `solid` material applies only to `snapshot/element` targets. Other sources
  report a target error and keep fallback behavior through the existing runtime
  error path.
- Effects do not scan DOM, add pointer listeners, create renderers, own resource
  loaders, expose Three.js flags, or form a custom registry.

Delivered Phase 6.1 behavior:

- Public API and visible Phase 5 behavior are unchanged.
- Pure effect modules own normalization, source compatibility, target
  capability types, and pointer motion without importing Three.js, React, demo
  code, or renderable implementations.
- Three.js-specific effect target adapters live under renderable adapter
  modules.

Delivered Phase 6.2 behavior:

- Public declarations support `effects.material: { kind: "surface" }` for
  explicit WebGL-owned rounded element snapshot surfaces.
- `surface` supports declaration-owned numeric `color`, `opacity`, and `radius`
  only.
- `surface` applies only to `snapshot/element` targets through the modular
  element-plane effect target adapter.
- Border, shadow, gradients, and CSS paint cloning remain out of scope unless a
  separately approved Phase 6.3 gate includes them.

Delivered Phase 7 behavior:

- Preserve the current Phase 6 object-form `effects.material` and
  `effects.motion` declarations as compatibility input.
- Add an ordered effect declaration model that compiles both legacy object-form
  declarations and new effect entries into the same internal execution path.
- Move built-in `solid`, `surface`, and `pointer-tilt` behavior behind
  registry-driven runtime plugin primitives with explicit source and target
  capability checks.
- Expose custom effect registry primitives through the root public entrypoint
  and allow `createWebGLRuntime({ effectRegistry })` to run registered effects
  against existing target capabilities.
- Keep text mutation, shader authoring, particles, picking, multiple canvases,
  third-party scroll adapters, and CSS paint cloning outside Phase 7 unless a
  later plan defines the missing target capabilities first.

Text animation effects such as scrambled text require an explicit text target
capability. They should not run by mutating native DOM and waiting for snapshot
refresh, because that couples effect timing to browser paint and snapshot
cadence. They also should not edit a bitmap snapshot directly unless the target
exposes that as a supported capability. The intended future path is a
`snapshot/text` effect target that exposes controlled text-content or
text-texture updates to registered effects.

## Non-Goals For The New Project

- Do not create multiple WebGL canvases to solve ordering.
- Do not expose Three.js ordering flags as the main page API.
- Do not start the project with a general-purpose effect registry. Later
  registry work must come from an explicit effect-runtime plan with source and
  target capability boundaries.
- Do not port archived effect implementations first.
- Do not use class-based effect compatibility layers.
- Do not let every renderable or effect own its own pointer listeners.
- Do not let scroll behavior, render role, and pointer behavior collapse into one mixed abstraction.
- Do not build a full CSS-to-WebGL engine as the primary visual styling path.
- Do not fix visual differences by hardcoding demo CSS, demo class names, or
  demo asset paths into runtime code.

## Architecture Principles

1. DOM is the authoring model.
2. DOM provides layout, content, accessibility, and interaction state.
3. WebGL effects/materials provide final visual styling.
4. WebGL is the compiled visual runtime.
5. `renderRole` is the semantic bridge between source and render policy.
6. Public API defaults should cover common cases with minimal configuration.
7. Scroll input can either move the page or drive a gated scene.
8. Pointer input is shared runtime state.
9. Effects come after the base path and consume runtime-owned objects.
10. CSS paint cloning is not the roadmap.
11. One renderer owns visual output.
12. Keep page semantics out of core runtime.
13. Prefer explicit internal contracts over historical compatibility.
14. Optimize for a straight path a new maintainer can understand quickly.
