# DOM WebGL Workspace

DOM-first interactive WebGL runtime workspace.

## Status

Phase 1 is complete through Task 37 in `docs/IMPLEMENTATION_PLAN.md`.
Phase 2 scene-gated scroll work is complete through Task 56 in
`docs/PHASE2_SCENE_GATE_PLAN.md`.
The next implementation plan is Phase 3 visible renderables in
`docs/PHASE3_VISIBLE_RENDERABLE_PLAN.md`.

Current demo behavior:

- React demo declares five target categories through public APIs: element
  snapshot, text snapshot, image, video, and GLB model.
- The demo declares one scene gate through `WebGLTarget` using the public
  `webgl.scroll` gate declaration shape.
- Runtime registration, source inference, render role inference, renderable
  creation, resource lifecycle, debug state, page scroll state, scene gate state,
  scroll lock, and pointer state are wired.
- The debug panel shows current scroll mode plus active gate key and
  `sceneProgress` while a gate is active.
- The runtime creates one Three.js renderer/canvas per runtime instance.
- Demo assets are loaded from `apps/demo/public`.

Current visual boundary:

- The demo still shows DOM fallback content as the primary visible surface.
- The runtime does not yet render DOM snapshots, image/video planes, or GLB
  objects as visible Three.js scene content.
- Phase 3 will make every supported source type enter the runtime-owned Three.js
  scene and will add verified DOM fallback hiding, including a child-preserving
  mode for container targets.
- Phase 2 includes scene-gated scroll, scroll lock, `sceneProgress`, and
  explicit reverse gate behavior.
- Effect registry, animation/effect layers, WebGL raycast picking, Lenis, GSAP,
  and ScrollTrigger adapters remain intentionally out of scope.
- The runtime keeps one WebGL canvas per runtime instance and does not expose
  Three.js `renderOrder`, `transparent`, or `depthWrite` in the public API.

## Setup

```bash
npm install
```

Workspace checks:

```bash
npm run check
npm run build
npm run check:imports
```

## Demo

Run locally:

```bash
npm run dev -w @project/dom-webgl-demo
```

Run for LAN access:

```bash
npm run dev -w @project/dom-webgl-demo -- --host 0.0.0.0
```

Demo assets must exist at:

```txt
apps/demo/public/demo/image.png
apps/demo/public/demo/video.mp4
apps/demo/public/models/hero.glb
```

The demo references them as:

```txt
/demo/image.png
/demo/video.mp4
/models/hero.glb
```

## Public API Imports

Use only public package entrypoints:

```ts
import type { WebGLDeclaration, WebGLDebugState } from "@project/dom-webgl-runtime";
import {
  WebGLRuntime,
  WebGLTarget,
  useWebGLRuntime,
} from "@project/dom-webgl-runtime/react";
```

`apps/demo` must not import from `packages/dom-webgl-runtime/src/*`.

## Scene Gates

Declare a scene gate through the same public `webgl` object used by regular
targets:

```tsx
<WebGLTarget
  as="section"
  webgl={{
    key: "demo.surface",
    scroll: {
      type: "gate",
      start: "top top",
      duration: 1,
      release: "both-directions-complete",
    },
  }}
/>
```

Gate behavior:

- `start` supports the Phase 2 geometry anchors covered by tests, including
  `top top`, `center center`, and `bottom bottom`.
- `duration` is a viewport-multiple scroll budget. With a 1000px viewport and
  `duration: 1`, a 250px wheel delta advances `sceneProgress` by `0.25`.
- While a gate is active, the runtime locks page scroll, consumes wheel/touch
  deltas, and emits frame input with `mode: "gate"`, `activeGateKey`, and
  `sceneProgress`.
- Completion releases scroll lock and returns to page scroll mode.
- `release: "forward-complete"` does not trap reverse scrolling.
- `release: "both-directions-complete"` supports reverse entry from below,
  starts at `sceneProgress: 1`, and releases backward at `sceneProgress: 0`.

The debug panel and public `WebGLDebugState` expose `currentScrollMode`,
`activeGateKey`, and `sceneProgress`. Gate-only fields are omitted in page mode.

## Verification

Common checks:

```bash
npm run check
npm run build
npm run check:imports
git diff --check
```
