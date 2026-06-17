# DOM WebGL Workspace

DOM-first interactive WebGL runtime workspace.

## Status

Phase 1 is complete through Task 37 in `docs/IMPLEMENTATION_PLAN.md`.
The delivered runtime covers the Phase 1 MVP only; scene-gated scroll and
effect work remain future scope.

Current demo behavior:

- React demo declares five Phase 1 target categories through public APIs:
  element snapshot, text snapshot, image, video, and GLB model.
- Runtime registration, source inference, render role inference, renderable
  creation, resource lifecycle, debug state, page scroll state, and pointer state
  are wired.
- The runtime creates one Three.js renderer/canvas per runtime instance.
- Demo assets are loaded from `apps/demo/public`.

Current Phase 1 visual boundary:

- The demo still shows DOM fallback content as the primary visible surface.
- Phase 1 does not yet render DOM snapshots, image/video planes, or GLB objects as
  visible Three.js scene content.
- Scene-gated scroll, effect registry, scroll lock, `sceneProgress`, WebGL
  raycast picking, reverse gate behavior, Lenis, and GSAP ScrollTrigger adapters
  are intentionally out of scope.
- Phase 1 keeps one WebGL canvas per runtime instance and does not expose
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

## Verification

Common checks:

```bash
npm run check
npm run build
npm run check:imports
git diff --check
```
