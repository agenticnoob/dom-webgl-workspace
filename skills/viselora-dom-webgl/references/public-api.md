# Public API

Compatible package version: 0.1.0-alpha.0

Import only these entrypoints:

- `@viselora/dom-webgl`: `defineWebGLEffect`, declaration/context types, and the imperative `createWebGLRuntime` API.
- `@viselora/dom-webgl/react`: `WebGLRuntime`, `WebGLTarget`, `WebGLScene`, `WebGLCamera`, `WebGLRenderPass`, `WebGLPassViewport`, `WebGLStagePlane`, `WebGLStageBox`, `WebGLLight`, `WebGLModel`, and debug hooks.
- `@viselora/scroll-adapters`: non-React Lenis, GSAP, ScrollTrigger, and progress-store glue.
- `@viselora/scroll-adapters/react`: `WebGLScrollRuntime`, `WebGLScrollTimeline`, `ScrollEffectSection`, and `useScrollEffectProgressStore`.

## Target declarations

Use `WebGLTarget` for DOM-anchored rendering:

```tsx
<WebGLTarget
  as="img"
  src="/media/photo.webp"
  alt="Product detail"
  webgl={{
    key: "product-photo",
    source: { kind: "media", type: "image", src: "/media/photo.webp" },
    pointer: { hover: true },
    lifecycle: {
      hideWhenReady: true,
      hideMode: "self",
      offscreen: { strategy: "restore-dom" },
    },
    effects: [{ kind: "app.photoHover" }],
  }}
/>
```

Valid source declarations are:

- `{ kind: "dom", type: "element" | "text" }`
- `{ kind: "media", type: "image" | "video", src }`
- `{ kind: "media", type: "image-sequence", frameCount, frames, progressKey, startFrame? }`
- `{ kind: "model", type: "glb", src, loader? }`

Use effect declarations only in array form: `effects: [{ kind: "app.effect" }]`.

## Effect context

Define application-owned kinds with `defineWebGLEffect`. Use the managed `ctx.object` facade:

- shared: `position`, `rotation`, `scale`, `visible`, `opacity`
- drawing/material: `surface`, `material`, `material.createLayer(...)`
- media: `texture`, `video`
- models: `model.meshes`, `animation`, `lights`
- progress/input: `ctx.progress.get(key)`, `ctx.scrollProgress`, `ctx.targetPointer`
- timing/resources: `ctx.time`, `ctx.delta`, `ctx.resources`

Treat all raw renderers, scenes, cameras, loaders, mixers, materials, and render targets as runtime-owned.

## Scroll timelines

Use one named progress path:

```tsx
<WebGLScrollTimeline id="product-progress" pin scrub>
  {/* targets use progressKey: "product-progress" */}
</WebGLScrollTimeline>
```

The timeline must be inside `WebGLScrollRuntime`. `progressKey` defaults to the timeline `id`.
