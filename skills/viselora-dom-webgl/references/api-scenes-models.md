# Scenes And Models API

Compatible package version: 0.1.0-alpha.0

## Contents

- [Scene camera pass and viewport](#scene-camera-pass-and-viewport)
- [Stage primitives and lights](#stage-primitives-and-lights)
- [Scene-native models](#scene-native-models)
- [Scene object effects](#scene-object-effects)
- [Placement and model controls](#placement-and-model-controls)

## Scene camera pass and viewport

**When to use:** escalate from plain targets when a beat needs an explicit
managed scene, camera, pass, DOM-bound viewport or pass postprocess.
**Public entrypoint:** `@viselora/dom-webgl/react` exports `WebGLScene`,
`WebGLCamera`, `WebGLRenderPass` and `WebGLPassViewport`.
**Declaration/props shape:** declare stable ids, projection, camera framing,
scene render ownership and optional `viewport: { mode: "dom-rect" }`.
**Ownership and stability:** runtime owns scenes/cameras/passes; React props are
descriptors, not high-frequency mutation handles.
**Fallback and lifecycle:** DOM content outside scene-native objects remains the
semantic fallback; a viewport does not create a second canvas.
**Version limitations:** status is experimental until the external clipped
pixel matrix completes.

```tsx
import { WebGLCamera, WebGLPassViewport, WebGLScene } from "@viselora/dom-webgl/react";
<WebGLPassViewport id="story.viewport"><WebGLScene id="story.scene" render={{ camera: "story.camera", viewport: { mode: "dom-rect" } }}><WebGLCamera id="story.camera" default /></WebGLScene></WebGLPassViewport>;
```

**Direct verification:** assert the pass is clipped, offscreen work is skipped,
one canvas remains, and final pixels change inside—not outside—the viewport.

## Stage primitives and lights

**When to use:** choose `WebGLStagePlane`, `WebGLStageBox` and `WebGLLight` for
managed lit scene substrate.
**Public entrypoint:** `@viselora/dom-webgl/react`.
**Declaration/props shape:** provide scene/id, size/transform, descriptor-only
material/light, optional timeline/interaction/physics.
**Ownership and stability:** runtime owns geometry, materials and lights.
**Fallback and lifecycle:** stage objects have no DOM fallback; the surrounding
story beat must remain meaningful without them.
**Version limitations:** scene/stage browser coverage is experimental here.

```tsx
import { WebGLLight, WebGLStagePlane } from "@viselora/dom-webgl/react";
<><WebGLStagePlane id="floor" scene="story.scene" role="floor" /><WebGLLight id="key" scene="story.scene" kind="point" /></>;
```

**Direct verification:** assert lighting/material pixels and cleanup on unmount.

## Scene-native models

**When to use:** choose `WebGLModel` for a model owned by a managed scene rather
than a DOM rect.
**Public entrypoint:** `@viselora/dom-webgl/react`.
**Declaration/props shape:** provide id/scene/src, stable transform, loader,
prepare, timeline, animation/morph and optional effects/interaction/physics.
**Ownership and stability:** runtime owns GLB loading, clone, mixer, animation,
morph/rig data and disposal.
**Fallback and lifecycle:** `WebGLModel` has no target fallback; provide a poster
or text in the surrounding DOM story.
**Version limitations:** scene-native models are experimental; verified GLB
loading does not prove DOM-anchored GLB visible output.

```tsx
import { WebGLModel } from "@viselora/dom-webgl/react";
<WebGLModel id="product" scene="story.scene" src="/models/product.glb" />;
```

**Direct verification:** assert asset ready plus clipped final-canvas model
pixels, named animation/morph behavior and network fallback.

## Scene object effects

**When to use:** choose `defineWebGLSceneObjectEffect` for stage/model visual or
managed picking behavior.
**Public entrypoint:** `@viselora/dom-webgl`.
**Declaration/props shape:** register a module-scope definition and reference its
kind from stable scene-object `effects`.
**Ownership and stability:** use managed `ctx.objectPointer`, object facade and
`ctx.resources`; no raycaster/intersection/camera handles.
**Fallback and lifecycle:** keep interactive meaning in DOM controls.
**Version limitations:** scene-object interaction is experimental.

```ts
import { defineWebGLSceneObjectEffect } from "@viselora/dom-webgl";
const hover = defineWebGLSceneObjectEffect({ kind: "app.sceneHover", update(ctx) { ctx.object.opacity = ctx.objectPointer.isInside ? 1 : 0.7; } });
```

**Direct verification:** assert managed pick state, touch alternative, pixels
and resource disposal.

## Placement and model controls

Use descriptor-only DOM/screen/depth/stage/screen-plane placement. Use public
animation, morph, rig, sampling, material and light facades. Never add raw
camera, loader, mixer, mesh, geometry or renderer workarounds. For a ready and
active DOM-anchored GLB with unchanged final pixels, keep fallback and create a
minimal public-boundary reproduction.
