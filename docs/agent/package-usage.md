# Agent Contract: Package Usage

Purpose: guide AI agents that integrate the published DOM WebGL runtime package
into downstream applications. This is package-consumer documentation, not a
workspace example guide and not a human tutorial. Treat every rule below as
implementation policy.

## Package Truth

- Use public package entrypoints only.
- Root entrypoint owns vanilla runtime creation and effect authoring.
- React entrypoint owns React runtime/provider/target plus opt-in
  scene/camera/pass declaration components.
- Applications own concrete visual effects.
- The package owns layout measurement, runtime lifecycle, internal source/target
  assembly, frame input, pointer state, scroll state, managed resources, and the
  controlled effect-object boundary.
- Native page scroll is the default. Scene gates are historical optional
  scroll-locking behavior. Third-party smooth-scroll systems use
  `WebGLScrollAdapter`; optional Lenis/GSAP/ScrollTrigger glue lives outside
  core in `<scroll-adapters-package>`.
- Pinned scroll effects are not authored with scene gates. Use the optional
  `<scroll-adapters-package>/react` layer when a React consumer wants bounded
  GSAP-pinned sections that feed stable `progressKey` values into
  `ctx.progress.get(key)`.
- The package does not provide default visual effects or an official
  `effects` preset subpath.
- Target effects use array-form declarations only:
  `effects: [{ kind: "app.effect", ...params }]`. Do not use legacy
  object-form `effects.material` or `effects.motion`.

## Effect Object Direction

Read `docs/agent/effect-object-boundary.md` before designing new effect
capabilities. The public effect context exposes `ctx.object` as the controlled
Three-like facade. Source, target, and visual handles are internal runtime
assembly details, not public effect authoring API.

Forward public effect authoring should center on one controlled Three-like
object:

```ts
defineWebGLEffect({
  kind: "app.hero",
  update(ctx) {
    const object = ctx.object;

    object.position.y = Math.sin(ctx.time / 1000) * 24;
    object.rotation.y += ctx.delta / 1000;
    object.scale.setScalar(1.08);
    object.opacity = 0.82;
  },
});
```

Effect authors use `ctx.object` for all visual control and source-backed
capabilities. Do not add new public source-specific capability families without
first designing their object-facade shape.

## Public Imports

Replace `<runtime-package>` with the actual published npm package name. In this
workspace before publication, the package name is `@project/dom-webgl-runtime`.

Use:

```ts
import {
  createWebGLRuntime,
  createEffectDeclarations,
  defineWebGLEffect,
  type WebGLEffectsDeclarationOf,
  type WebGLDeclaration,
  type WebGLEffectContext,
  type WebGLEffectDefinition,
  type WebGLEffectSchedule,
  type WebGLCameraDeclaration,
  type WebGLCameraFramingDeclaration,
  type WebGLCameraMode,
  type WebGLCameraType,
  type WebGLPerformanceBudget,
  type WebGLPerformanceWarning,
  type WebGLPlacementDeclaration,
  type WebGLPlacementMode,
  type WebGLRenderPassDeclaration,
  type WebGLRuntimeOptions,
  type WebGLScrollAdapter,
  type WebGLScreenAnchor,
  type WebGLSceneDeclaration,
  type WebGLSceneProjection,
  type WebGLTransformScope,
  type WebGLTuple2,
  type WebGLTuple3,
} from "<runtime-package>";
```

Use for React:

```tsx
import {
  WebGLCamera,
  WebGLRuntime,
  WebGLScene,
  WebGLTarget,
  useWebGLRuntime,
} from "<runtime-package>/react";
```

Use for the high-level pinned scroll React adapter:

```tsx
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "<scroll-adapters-package>/react";
```

Do not use:

```ts
import ... from "<runtime-package>/effects";
import ... from "<runtime-package>/src";
import ... from "packages/dom-webgl-runtime/src";
import ... from "packages/dom-webgl-scroll-adapters/src";
import { createInitialPointerState } from "<runtime-package>";
```

## Runtime Performance Budgets

Consumers can pass a stable `performanceBudget` through runtime options. The
budget does not expose raw renderer, camera, scene, material, render target, or
composer objects. It only configures runtime-owned counters and resource-load
pressure:

```ts
const performanceBudget = {
  maxActiveTargets: 50,
  maxActiveSnapshots: 30,
  maxActiveVideos: 4,
  maxActiveModels: 8,
  maxTextureSize: 4096,
  maxConcurrentResourceLoads: 6,
  maxDrawCalls: 300,
  maxTextureCount: 256,
  maxRenderTargetSize: 4096,
  maxPostprocessRequests: 4,
} satisfies WebGLPerformanceBudget;

const runtime = createWebGLRuntime({
  container,
  performanceBudget,
  onDebugStateChange(state) {
    for (const warning of state.warnings ?? []) {
      warning satisfies WebGLPerformanceWarning;
    }
  },
});
```

`WebGLDebugState.warnings` currently emits
`performance-budget-exceeded` records for active target, snapshot, video, model,
internal texture-size telemetry, renderer draw calls, renderer texture count,
postprocess request count, and postprocess render-target size. Texture-size
records use `target: "textureSize"` and the configured `maxTextureSize` limit.
Debug state does not expose raw renderer info, raw texture lists, render
targets, or composer passes; consumers should react to warning records rather
than inspecting internal Three.js objects.

Resource loading uses `maxConcurrentResourceLoads` as an internal queue limit.
Runtime-owned loads are also prioritized by viewport lifecycle state when they
are initiated. Active viewport targets carry the highest priority; lower
priority states are reserved for future eager preloading paths. Do not build a
second loader inside effects or renderables to bypass this queue.
Resource cache keys preserve relative/app-local `pathname + search + hash`; for
absolute HTTP(S) and protocol-relative URLs, cache keys include origin as well.

`createInitialPointerState` is a package-internal helper. Consumers receive
runtime/canvas pointer state through `ctx.pointer` or `ctx.input.pointer`, and
current-target layout-local pointer state through `ctx.targetPointer` or target
debug state.

## Runtime Setup

There are four supported consumer routes.

### 1. Plain Runtime

React:

```tsx
import { WebGLRuntime, WebGLTarget } from "<runtime-package>/react";

const runtimeEffects = [appSurfaceEffect, appPointerEffect] as const;

export function App() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLTarget
        webgl={{
          key: "hero.surface",
          source: { kind: "dom", type: "element" },
          effects: [{ kind: "app.surface", opacity: 0.82 }],
        }}
      >
        Hero content
      </WebGLTarget>
    </WebGLRuntime>
  );
}
```

Vanilla:

```ts
import { createWebGLRuntime } from "<runtime-package>";

const runtime = createWebGLRuntime({
  container,
  effects: [appSurfaceEffect, appPointerEffect],
});

runtime.registerTarget(element, {
  key: "hero.surface",
  source: { kind: "dom", type: "element" },
  effects: [{ kind: "app.surface", opacity: 0.82 }],
});

runtime.sync();
```

Rules:

- Keep the runtime-level `effects` array reference stable. In React, define it at
  module scope or memoize it.
- Every target key must be stable and unique inside one runtime.
- Treat each target `webgl` declaration as registration-time static. Do not
  dynamically change `source`, `effects`, `scroll`, `pointer`, `lifecycle`, or
  `transformScope` under the same key; use a new key or remount the target when
  the declaration must change.
- Target `webgl.effects` contains data only. The executable effect definition is
  registered at runtime level.
- Use array-form target effects only. Legacy object-form declarations such as
  `effects: { material: ..., motion: ... }` are outside the forward package
  contract.
- Do not create nested runtimes unless the application intentionally needs
  independent canvases and lifecycle ownership.
- Nested `WebGLTarget` children are supported inside one runtime. Use them for
  WebGL-owned panels, cards, captions, or markers with child layers instead of
  manually adding child Object3D instances from a parent effect.

### 2. Opt-In Managed Scene Ownership

Use this route only when DOM-backed targets need explicit scene/pass ownership.
Plain `WebGLTarget` remains the shortest path.

React:

```tsx
import {
  WebGLCamera,
  WebGLRuntime,
  WebGLScene,
  WebGLTarget,
} from "<runtime-package>/react";

export function App() {
  return (
    <WebGLRuntime effects={runtimeEffects}>
      <WebGLScene id="world" render={{ camera: "world.camera" }}>
        <WebGLCamera id="world.camera" default />
        <WebGLTarget
          webgl={{
            key: "world.model",
            source: { kind: "model", type: "glb", src: "/models/hero.glb" },
          }}
        >
          <div aria-label="World model fallback" />
        </WebGLTarget>
      </WebGLScene>

      <WebGLScene
        id="overlay"
        projection="screen"
        render={{ camera: "overlay.camera", order: 1, clearDepth: true }}
      >
        <WebGLCamera id="overlay.camera" default mode="screen" />
        <WebGLTarget
          webgl={{
            key: "overlay.title",
            placement: {
              mode: "screen-anchored",
              anchor: "top-right",
              offset: [-32, 32],
            },
            source: { kind: "dom", type: "text" },
          }}
        >
          Overlay title
        </WebGLTarget>
      </WebGLScene>
    </WebGLRuntime>
  );
}
```

Vanilla:

```ts
runtime.registerScene({ id: "world", defaultPass: true });
runtime.registerCamera({
  id: "world.camera",
  sceneId: "world",
  default: true,
});
runtime.registerRenderPass({
  id: "world.pass",
  sceneId: "world",
  cameraId: "world.camera",
});
runtime.registerTarget(element, {
  key: "world.model",
  sceneId: "world",
  source: { kind: "model", type: "glb", src: "/models/hero.glb" },
});
```

Perspective-stage scenes use a perspective camera and an explicit placement:

```tsx
<WebGLScene
  id="hero.stage"
  projection="perspective-stage"
  render={{ camera: "hero.camera" }}
>
  <WebGLCamera
    id="hero.camera"
    default
    type="perspective"
    mode="perspective-stage"
    fov={42}
    position={[0, 0, 700]}
    target={[0, 0, 0]}
  />
  <WebGLTarget
    webgl={{
      key: "hero.model",
      placement: { mode: "screen-depth", depth: 260 },
      source: { kind: "model", type: "glb", src: "/models/hero.glb" },
    }}
  >
    <div aria-label="Hero model fallback" />
  </WebGLTarget>
</WebGLScene>
```

Rules:

- `WebGLTarget` inside `WebGLScene` inherits that scene unless
  `webgl.sceneId` is explicit.
- Targets outside `WebGLScene` use the internal generated Level 1 default
  scene. Consumer ids such as `main` are ordinary managed ids.
- Unregistering or unmounting a managed scene releases live targets still
  routed to that scene.
- Supported scene projections are `dom-aligned`, `screen`, and
  `perspective-stage`.
- Supported target placements are `dom-anchored`, `screen-anchored`,
  `screen-depth`, and `stage-local`.
- Use orthographic cameras for `dom-aligned` and `screen` scenes. Use
  perspective cameras with `mode: "perspective-stage"` for perspective-stage
  scenes.
- `screen-depth` is the initial perspective DOM bridge. `screen-plane` waits
  for named managed stage planes.
- In React, prefer `WebGLScene render` for scene-owned rendering. Vanilla users
  can use `registerRenderPass`, and React still exposes `WebGLRenderPass` for
  advanced explicit pass descriptors.
- A scene only needs a camera when it opts into rendering with `render` or
  `defaultPass`; the generated pass waits until the referenced/default camera
  is registered.
- `WebGLScene`, `WebGLCamera`, and `WebGLRenderPass` are managed descriptors,
  not raw Three.js handles. Do not pass or expect raw renderer, scene, camera,
  object, material, composer, render target, or pass objects.
- Scene-native `WebGLModel`, named stage primitives, pass-scoped postprocess,
  and scoped `ctx.scene`/`ctx.camera` effects remain later phases.

### 3. High-Level Pinned Scroll React Adapter

For the normal "pinned section drives an effect" story, use
`<scroll-adapters-package>/react`. The wrapper owns the runtime progress store;
each `ScrollEffectSection` owns one bounded trigger instance and clears only its
own progress key during cleanup.

```tsx
import { defineWebGLEffect } from "<runtime-package>";
import { WebGLTarget } from "<runtime-package>/react";
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "<scroll-adapters-package>/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const pinnedRevealEffect = defineWebGLEffect<{
  kind: "app.pinnedReveal";
  progressKey: string;
}>({
  kind: "app.pinnedReveal",
  update(ctx, _state, params) {
    const progress = ctx.progress.get(params.progressKey);
    ctx.object.opacity = progress;
  },
});

const runtimeEffects = [pinnedRevealEffect] as const;

export function App() {
  return (
    <WebGLScrollRuntime effects={runtimeEffects} smooth={false}>
      <ScrollEffectSection
        progressKey="article.hero.reveal"
        ScrollTrigger={ScrollTrigger}
        pin
        scrub
      >
        <WebGLTarget
          webgl={{
            key: "article.hero",
            source: { kind: "dom", type: "element" },
            effects: [
              {
                kind: "app.pinnedReveal",
                progressKey: "article.hero.reveal",
              },
            ],
          }}
        >
          章节滚动驱动 WebGL 效果
        </WebGLTarget>
      </ScrollEffectSection>
    </WebGLScrollRuntime>
  );
}
```

Rules:

- Effects read section progress with `ctx.progress.get(progressKey)`.
- Missing progress keys read as `0`.
- Let `ScrollEffectSection` own GSAP ScrollTrigger `pin`/`scrub` for ordinary
  pinned effects.
- The scroll-adapter progress store notifies the runtime when a key changes,
  so ScrollTrigger scrub updates wake on-demand renderables such as
  `media/image-sequence` targets.
- Keep `progressKey` stable and pass it as target effect data; do not mutate
  mounted `webgl.effects` on every scroll update.
- For pinned scrub sections, let `ScrollEffectSection` own the pinned subtree,
  progress key, and scrub duration. Keep cards, captions, and copy inside that
  pinned subtree only when they should remain in the pinned viewport; drive
  their visual changes with effects rather than normal DOM scrolling.
- `end="+=..."` is a scrub duration measured relative to the start point, not a
  content layout model. Use it when the pinned effect should last a fixed
  scroll distance.
- Do not add a synthetic post-pinned runway sibling just to hand scroll back to
  the page.
- This is not a scene gate. The runtime should remain in page scroll mode while
  ScrollTrigger handles pin/scrub behavior.
- If `WebGLScrollRuntime smooth={...}` includes `ScrollTrigger`, child
  `ScrollEffectSection` components inherit it from context and do not need a
  repeated `ScrollTrigger` prop.
- If `WebGLScrollRuntime` receives an advanced `scrollAdapter`, it bypasses its
  built-in smooth-stack creation and forwards that adapter to the runtime.

### 4. Advanced Manual `scrollAdapter`

Use a scroll adapter only when the application already owns a third-party
scroll system:

```ts
import { createWebGLRuntime, type WebGLScrollAdapter } from "<runtime-package>";

declare const lenisBackedAdapter: WebGLScrollAdapter;

const runtime = createWebGLRuntime({
  container,
  scrollAdapter: lenisBackedAdapter,
});
```

Rules:

- Core receives only `WebGLScrollAdapter`; it must not receive a raw Lenis,
  GSAP, or ScrollTrigger instance.
- Effects keep reading `ctx.scroll` and `ctx.scrollProgress`; they should not
  read third-party scroll instances directly.
- Pinned scroll effects should read `ctx.progress.get(progressKey)`, not
  `sceneProgress`, unless the product intentionally uses a scroll-locking gate.
- Keep `scrollAdapter` reference stable. In React, define the adapter at module
  scope, in a stable ref, or in a memoized integration component that owns the
  third-party instance lifecycle.
- Changing `scrollAdapter` recreates the runtime. Keep it stable once ready to
  avoid unnecessary runtime churn.
- Adapter cleanup owns only listeners, ticker callbacks, and proxy hooks created
  by the adapter. Destroying a consumer-owned Lenis instance must be explicit.
- See `docs/agent/scroll-adapters.md` for optional Lenis, GSAP ticker, and
  ScrollTrigger bridge rules.

### Official Smooth Scroll Stack

The advanced manual third-party route is the opt-in Lenis + GSAP ticker +
ScrollTrigger stack from `<scroll-adapters-package>`. Prefer the React adapter
subpath above for ordinary pinned section progress.

```ts
import { createLenisGsapScrollStack } from "<scroll-adapters-package>";

const smoothScroll = createLenisGsapScrollStack({
  lenis,
  gsap,
  ScrollTrigger,
  manageLenis: false,
});

const runtime = createWebGLRuntime({
  container,
  scrollAdapter: smoothScroll.scrollAdapter,
});
```

Rules:

- This stack is not the core runtime default; native scroll remains the default
  when `scrollAdapter` is omitted.
- Configure Lenis with `autoRaf: false` when GSAP drives `lenis.raf(...)`.
- When the application creates Lenis, keep `manageLenis: false`, call
  `smoothScroll.dispose()` from the application lifecycle, and explicitly call
  `lenis.destroy()` from that same cleanup.
- Use `smoothScroll.refresh(true)` after layout changes that should force
  ScrollTrigger to recalculate positions.

## React Effect Authoring Example

The current downstream-style React example lives in `apps/example`.

- Source code: `apps/example/src/App.tsx`,
  `apps/example/src/SnapshotElementExamples.tsx`,
  `apps/example/src/exampleEffects.ts`, and
  `apps/example/src/surfaceEffects.ts`,
  `apps/example/src/textEffects.ts`, `apps/example/src/mediaEffects.ts`, and
  `apps/example/src/modelEffects.ts`.
- Visible page explanations are Chinese; source kinds and effect kind strings
  remain English API data.
- The example is the dogfood surface for package usage and effect authoring,
  including high-level pinned scroll adapter usage as it lands.
- Tutorial: `docs/examples/effect-authoring.md`.
- Friction report: `docs/agent/effect-authoring-example-report.md`.

Treat this example as consumer application code. Do not import it from package
source, and do not promote its effects into runtime package exports.

## Target Declaration

Minimum target:

```ts
const declaration: WebGLDeclaration = {
  key: "card.primary",
  source: { kind: "dom", type: "element" },
};
```

Parent transform group:

```ts
const scope: WebGLTransformScope = "subtree";

const declaration: WebGLDeclaration = {
  key: "card.primary",
  source: { kind: "dom", type: "element" },
  transformScope: scope,
};
```

Effect target:

```ts
const declaration: WebGLDeclaration = {
  key: "model.hero",
  source: { kind: "model", type: "glb", src: "/models/hero.glb" },
  lifecycle: { hideWhenReady: true, hideMode: "subtree" },
  effects: [
    { kind: "app.modelRotate", speed: 0.15 },
    { kind: "app.modelParticles", color: "rgb(255, 0, 0)", density: 2 },
  ],
};
```

Supported source declarations:

- `{ kind: "dom", type?: "element" | "text" }`
- `{ kind: "media", type: "image", src?: string }`
- `{ kind: "media", type: "video", src?: string }`
- `{ kind: "media", type: "image-sequence", frameCount: number, frames: readonly (HTMLImageElement | HTMLCanvasElement | ImageBitmap)[], progressKey?: string }`
- `{ kind: "model", type: "glb", src: string, loader?: WebGLModelLoaderDeclaration }`

Do not use old explicit declarations. `snapshot/mode`, top-level `image`,
top-level `video`, top-level `image-sequence`, and `model/format` are removed.
Media declarations can infer from real `img` / `video` elements, or use an
arbitrary HTMLElement anchor when `src` is provided.

Use declarative loader configuration for compressed GLB assets. The runtime owns
loader instances and decoder lifecycle:

```ts
source: {
  kind: "model",
  type: "glb",
  src: "/models/product.glb",
  loader: {
    draco: { decoderPath: "/draco/" },
  },
}
```

The declaration only tells the runtime where to find decoder assets. The
consumer app must still serve those files from its public/static asset root. A
Draco-compressed GLB without matching decoder files will fail with loader errors
such as `THREE.GLTFLoader: No DRACOLoader instance provided` or decoder 404s.
For example, `apps/example` serves `/models/4.glb` with decoder files under
`/draco/gltf/` and declares `loader: { draco: { decoderPath: "/draco/gltf/" } }`.

Use image sequences for frame-addressable scrub playback. Normal `video`
sources remain the better fit for continuous playback. The consumer must
provide a full-length frame array before registering the target; entries can
initially point to a ready preview frame and be replaced in place as real frames
finish loading. The runtime reads those consumer-owned resources and does not
own an image-sequence loader. If a page needs deterministic load order, keep
that policy in application code: kick off assets in DOM or business-priority
order, limit heavy sequence concurrency, then pass the usable `frames` into the
runtime:

```tsx
const frames = await loadFirstFrameThenBackfillSequence();

<WebGLTarget
  as="section"
  webgl={{
    key: "sequence.hero",
    source: {
      kind: "media",
      type: "image-sequence",
      frameCount: frames.length,
      frames,
      progressKey: "example.video.scrub",
    },
  }}
/>
```

Lifecycle rules:

- `hideWhenReady: true` is the default for registered targets.
- `hideWhenReady: false` keeps DOM fallback visible.
- `hideMode: "self"` is the safe default for mixed DOM/WebGL targets; children stay native DOM unless they register their own target.
- `hideMode: "subtree"` hides the target subtree after WebGL readiness and is only for explicitly WebGL-owned subtrees.
- Parent fallback hiding does not own nested managed target roots. A child
  `WebGLTarget` hides/restores its own fallback based on its own readiness.
- Failed or pending renderables keep fallback DOM visible.
- `lifecycle.offscreen.strategy: "restore-dom"` is the default far-offscreen
  policy: restore native DOM fallback before disposing offscreen renderables.
- `lifecycle.offscreen.strategy: "park"` enables near-offscreen parking: keep
  renderables briefly, pause effects, and hide the WebGL scene object.
- `lifecycle.offscreen.warmTtlMs` sets how long parking is retained before the
  runtime restores DOM fallback and disposes resources.

## Nested WebGL Targets

Use nested `WebGLTarget` elements when a card, panel, marker, caption, or
overlay has WebGL-owned children. The DOM tree stays the authoring model, while
runtime maps the nearest registered ancestor target to the parent WebGL layer.

Preferred pattern:

```tsx
<WebGLTarget
  className="marker"
  webgl={{
    key: "marker.surface",
    source: { kind: "dom", type: "element" },
    transformScope: "subtree",
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    effects: [{ kind: "app.surface", opacity: 0.72 }],
  }}
>
  <WebGLTarget
    as="p"
    className="marker-copy"
    webgl={{
      key: "marker.copy",
      source: { kind: "dom", type: "text" },
    }}
  >
    Text that should be ordered as a WebGL child of the marker.
  </WebGLTarget>
</WebGLTarget>
```

Rules:

- Runtime orders nested targets from DOM ancestry and sibling order across
  `dom/element`, `dom/text`, `media/image`, `media/video`,
  `media/image-sequence`, and `model/glb`. `renderRole` remains a local
  source-policy hint; it is not a substitute for the layer tree and is not
  required to make an ordinary child target paint above its parent.
- Add `transformScope: "subtree"` only when the parent target's own effect should
  move, rotate, scale, hide, or best-effort fade the declared WebGL subtree. The
  declaration is parent-side; children do not repeat a parent key.
- The parent target owns only its own source layer and fallback lifecycle.
  Nested child targets own their own source layer and fallback lifecycle.
- Child targets under a transform group still own their own effects, textures,
  resources, fallback visibility, and offscreen disposal. Parent lifecycle does
  not cascade into child renderables.
- DOM supplies layout anchors and layer semantics. Effect code supplies pixels:
  `dom/element` is a transparent layout surface until an effect draws to
  `ctx.object.surface`. Runtime core does not clone CSS backgrounds, borders,
  shadows, or other decorative paint into WebGL.
- Transform groups are internal runtime structure. Do not expose or request raw
  Three.js `Object3D`, `Group`, scene, camera, material, matrix, or public scene
  graph APIs for this path.
- Pointer state remains the existing layout/global pointer model in v1. Rotated,
  flipped, or inverse-transformed subtree picking is not supported.
- Do not call an effect resource helper from the parent to create child card or
  caption scene objects just to simulate target children.
- Put `dom/text` on the actual text-bearing element, such as `p`, `span`,
  `h1`, or `h2`; do not put it on a complex container just because the container
  contains text somewhere inside.
- If the DOM parent background, gradients, opacity, or filters must remain
  visible above the runtime canvas, keep that text as native DOM or make the
  entire visual treatment WebGL-owned.
- Do not rely on core text snapshots to inherit DOM `color`, background,
  opacity, shadow, or other visual styling. Text color and opacity should be
  explicit effect/material data when the application needs WebGL-owned text
  styling.

## Custom Effect Contract

Define effects with `defineWebGLEffect(...)`. The examples in this section use
the controlled `ctx.object` facade first:

```ts
import { defineWebGLEffect } from "<runtime-package>";

type AppSurfaceParams = {
  kind: "app.surface";
  opacity?: number;
};

export const appSurfaceEffect = defineWebGLEffect<AppSurfaceParams>({
  kind: "app.surface",
  source: "dom/element",
  update(ctx, _state, params) {
    ctx.object.visible = true;
    ctx.object.opacity = clampNumber(params.opacity, 0, 1, 1);
  },
});

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
```

Stateful effect:

```ts
type AppPulseParams = {
  kind: "app.pulse";
  strength?: number;
};

type AppPulseState = {
  phase: number;
};

export const appPulseEffect = defineWebGLEffect<AppPulseParams, AppPulseState>({
  kind: "app.pulse",
  setup(ctx) {
    ctx.resources.addDisposable(() => {
      // Dispose effect-owned listeners, objects, or handles.
    });

    return { phase: 0 };
  },
  update(ctx, state, params) {
    state.phase += ctx.delta / 1000;
    const strength = clampNumber(params.strength, 0, 2, 1);
    ctx.object.scale.setScalar(1 + Math.sin(state.phase) * 0.04 * strength);
  },
});
```

Model material, light, and animation effects still start at `ctx.object`:

```ts
const modelGlow = defineWebGLEffect({
  kind: "app.modelGlow",
  source: "model/glb",
  setup(ctx) {
    ctx.object.material?.emissive.set("#7dd3fc", 1.8);
  },
  update(ctx, _state, params: { lightIntensity?: number }) {
    ctx.object.lights?.point("glow", {
      color: "#7dd3fc",
      intensity: clampNumber(params.lightIntensity, 0, 8, 2.4),
      distance: 420,
      position: [
        ctx.layout.left + ctx.layout.width / 2,
        ctx.layout.viewport.height - (ctx.layout.top + ctx.layout.height / 2),
        180,
      ],
    });
    ctx.object.rotation.y += ctx.delta / 1000;
  },
});
```

Rules:

- `kind` in the definition must exactly match target declaration `kind`.
- Use namespaced kinds such as `app.surface`, `brand.heroParticles`, or
  `product.galleryTilt`.
- Do not use generic global names such as `fade`, `rotate`, or `particles`.
- Use `source` on the definition to restrict compatible source kinds.
- Use `ctx.object` for visual transform, visibility, opacity, postprocess, and
  source-backed capability modules.
- Clamp all untrusted numeric params.
- Use `ctx.delta` for motion. Do not rely on frame count.
- Create expensive resources in `setup`, not `update`.
- Runtime lights are keyed requests, not effect-owned raw lights. Reusing the
  same key updates the existing runtime-owned light, so dynamic intensity or
  position can be declared from `update`.
- If a `model/glb` effect leaves runtime layout in charge of model fit, put
  target-local lights at an explicit projected layout-center position.
  `follow: "object"` follows transform state written through
  `ctx.object.position`; it is not a substitute for the runtime layout fit
  position.
- Dispose effect-owned resources through `ctx.resources`.

## Type-Safe Effect Declarations

The `effects` array on a target declaration is checked at **runtime** (the registry
resolves `kind` strings against registered definitions). For **compile-time** protection
against misspelled params or unknown kinds, provide a type map and use the
`createEffectDeclarations()` helper or `WebGLEffectsDeclarationOf` type.

Define a param type map for your application:

```ts
interface AppEffectParams {
  "app.surface": { opacity?: number };
  "app.pointerTilt": { strength?: number; maxDegrees?: number };
  "app.modelSpin": { speed?: number };
  "app.modelGlow": { emissive?: string; lightIntensity?: number };
}
```

### Option 1: `createEffectDeclarations()` (零运行时成本)

```ts
import { createEffectDeclarations } from "<runtime-package>";

const effects = createEffectDeclarations<AppEffectParams>()([
  { kind: "app.surface", opacity: 0.82 },       // ✅ type-safe
  { kind: "app.pointerTilt", strength: 0.6 },   // ✅ type-safe
  // { kind: "app.surface", opcity: 0.82 },     // ❌ TS error: unknown property "opcity"
  // { kind: "app.unknown" },                    // ❌ TS error: kind not in AppEffectParams
]);

<WebGLTarget webgl={{ key: "card", effects }} />
```

### Option 2: `satisfies` + `WebGLEffectsDeclarationOf`（JSX 内联）

```tsx
import type { WebGLEffectsDeclarationOf } from "<runtime-package>";

const cardEffects = [
  { kind: "app.surface", opacity: 0.82 },
  { kind: "app.pointerTilt", strength: 0.6 },
] as const satisfies WebGLEffectsDeclarationOf<AppEffectParams>;

<WebGLTarget webgl={{ key: "card", effects: cardEffects }} />
```

### Rules

- Keep the type map (`AppEffectParams` above) in a shared module so effect
  definitions and target declarations share the same contract.
- The helper is zero-cost at runtime — it only adds a TypeScript type guard.
- For effects without params, use `Record<string, never>`:
  ```ts
  interface AppEffectParams {
    "app.toggle": Record<string, never>;
  }
  ```
- The type map approach does not eliminate the need for runtime `kind` matching.
  Unregistered effects still throw at runtime.

Scheduling hint:

```ts
const staticEffect = defineWebGLEffect({
  kind: "app.staticSurface",
  schedule: "static",
  update(ctx) {
    ctx.object.opacity = 1;
  },
});
```

Use `schedule: "static"` for one-shot setup-style effects and
`schedule: "reactive"` for effects that only need layout, pointer, scroll, DOM,
or resource-ready dirty updates. Omit the field, or use `schedule: "frame"`,
for effects that must run continuously. Scheduling is a runtime ownership hint;
it does not expose the render loop or give effects frame-loop ownership.

## Effect Context

Use context fields as the single runtime truth:

- `ctx.key`: target key.
- `ctx.layout`: current DOM layout snapshot and viewport size.
- `ctx.input`: full frame input.
- `ctx.pointer`: pointer state for the runtime coordinate element.
- `ctx.targetPointer`: current-target layout-local pointer state.
- `ctx.scroll`: page or gate scroll state.
- `ctx.scrollProgress`: active progress value for current scroll mode.
- `ctx.progress`: keyed progress signals from the runtime.
- `ctx.time`: runtime time in milliseconds.
- `ctx.delta`: frame delta in milliseconds.
- `ctx.object`: controlled visual facade and source-backed capability modules.
- `ctx.resources`: effect-owned resource scope.

Pointer rule:

- `ctx.pointer` is runtime/canvas pointer state.
- `ctx.targetPointer` is current-target layout-local pointer state.
- `ctx.targetPointer.isInside` is the hover check for the current target.
- `ctx.targetPointer.localX/localY` replace repeated
  `ctx.pointer.x - ctx.layout.left/top` math in effects.
- `ctx.targetPointer.normalizedX/Y` are target-local values in the same -1..1
  convention as runtime pointer coordinates.
- `pointer: { hover, press, click, drag }` declares which target-level pointer
  semantics should wake reactive effects.
- `longPress` is effect-level behavior built from
  `ctx.targetPointer.pressDuration`; runtime does not own a global threshold.
- Target pointer is layout-local only. It does not perform inverse-transformed
  picking for rotated groups, models, or custom meshes.

## Object Modules

For visual control and source-backed capabilities, use `ctx.object`:

```ts
ctx.object.visible = true;
ctx.object.position.set(0, 24, 0);
ctx.object.rotation.y += ctx.delta / 1000;
ctx.object.scale.setScalar(1.05);
ctx.object.opacity = 0.8;
```

Object modules:

- `ctx.object.surface`: canvas draw/clear/invalidate/material-layer controls.
- `ctx.object.text`: text, style, shader inputs, glyph read/write, and
  material-layer controls.
- `ctx.object.texture`: media src/frame metadata, shader inputs, texture
  transform, invalidate, and material-layer controls.
- `ctx.object.video`: video playback controls.
- `ctx.object.model`: model src, mesh list, vertex sampling, and managed point
  layers.
- `ctx.object.postprocess`: named postprocess requests.

DOM text remains the source of content, accessibility, and fallback.
`ctx.object.text.setText(...)` and `ctx.object.text.setGlyphs(...)` affect only the WebGL
output layer. Effects should not mutate DOM text for visual animation.

Glyph coordinates are text-layer local CSS-pixel coordinates. `glyph.x` and
`glyph.y` describe the glyph's top-left drawing position, and `glyph.height`
matches the line height. For pointer-local text effects such as scrambled text
or text pressure, compute the visual center as:

```ts
const centerX = glyph.x + glyph.width / 2;
const centerY = glyph.y + glyph.height / 2;
```

Do not treat `glyph.y` as a baseline or subtract half the glyph height; doing so
shifts the effect radius away from the cursor.

The package core does not include scrambled text, text pressure, image
distortion, media playback, or model particle effects. Those are application
effects built on these primitives.

Material layer rules:

- Use `createMaterialLayer(...)` through `ctx.object.surface`,
  `ctx.object.text.material`, `ctx.object.texture.material`, or model mesh
  handles.
- Material programs are Three-inspired shader declarations, not raw Three.js
  materials. Public fields are `vertexShader`, `fragmentShader`, `uniforms`,
  `defines`, and `blend`. Runtime-owned defaults decide transparency, depth,
  tone mapping, render order, material restoration, texture allocation, and
  disposal.
- Uniforms must stay plain serializable data. Use numbers, small numeric tuples,
  controlled texture uniform declarations, and supported numeric arrays such as
  `readonly (readonly [number, number])[]` for trail buffers. Do not pass raw
  Three.js `Uniform`, `Vector2`, `Texture`, material, pass, renderer, scene, or
  camera objects through public effect params.
- `{ kind: "source-texture" }` binds the runtime-owned source texture. DOM
  backed texture uniforms create runtime-owned Three textures internally.
- `setUniforms(...)` updates public uniform values; `clear()` restores the
  original material; `dispose()` is idempotent and releases runtime-owned
  material/texture resources.
- Effects never receive raw `ShaderMaterial`, `Texture`, renderer, scene,
  camera, composer, render target, render loop, pass ordering, or renderer-state
  handles.
- When porting a visual from a raw Three.js implementation, port the algorithm
  into public data and shader declarations only. Do not port the source
  renderer, scene, camera, composer, pass graph, render targets, or animation
  loop into package public API. If the visual needs a new primitive, add a
  generic controlled capability with package tests, not a one-off effect hook.

Model helper rules:

`ctx.object.model` exposes controlled model capabilities:

- `model.src` exposes the declared model source string.
- `model.meshes.all()` and `model.meshes.forEach(...)` expose controlled mesh handles.
- Mesh handles expose `index`, optional `name`, optional `materialName`,
  `createMaterialLayer(...)`, and `restoreMaterial()`.
- `model.sampling.vertices({ maxPoints })` returns root-local vertex positions for
  app-authored particle or point-layer effects.
- `model.points.create({ positions, color, size, material })` returns a
  managed handle whose generated geometry/material lifecycle is runtime-owned.
- Effects do not receive raw model root objects, raw mesh traversal, or raw
  point-cloud objects.
- GLB models with an internal loaded shape that includes both `animations` and
  a runtime/adapter-provided `mixer` are advanced by runtime-owned scheduling
  while the target is visible. Consumers still do not receive mixer handles.

Runtime-scoped visual requests:

```ts
const handle = ctx.object.postprocess.request({
  key: "app.softGlow",
  bloom: { strength: 0.45, radius: 0.2, threshold: 0.8 },
  grain: { amount: 0.04 },
});

ctx.resources.addDisposable(() => handle.dispose());
```

Duplicate request keys update the current named request. Disposing the handle
removes that request. Current runtime truth is request/handle ownership,
inspection, bounded internal bloom/grain/blur pass execution, and budget
warnings for request count and render-target size. The runtime owns pass
scheduling, render-target pooling, and resolution budgets; consumers do not
receive composer, pass-order, pass object, or render-target handles.
Postprocess requests are runtime-canvas scoped today. Do not use
`ctx.object.postprocess` when the visual requirement is a strictly target-local
model glow; prefer material/mesh emissive values and runtime-owned lights until
a future target-scoped postprocess capability exists.

## Object Transform Handles

Use `ctx.object` for visual transform, visibility, and opacity.
`position.set(...)` writes the runtime scene-object position. When deriving it
from a DOM layout snapshot, project the DOM center into scene coordinates as
shown below.

```ts
ctx.object.visible = true;
ctx.object.position.set(
  ctx.layout.left + ctx.layout.width / 2,
  ctx.layout.viewport.height - (ctx.layout.top + ctx.layout.height / 2),
  0,
);
ctx.object.rotation.set(0, ctx.targetPointer.normalizedX * 0.2, 0);
ctx.object.scale.setScalar(1.05);
ctx.object.opacity = 0.8;
```

For `model/glb` renderables, the runtime layout pass already fits the loaded
model bounds into the target rect. If an effect writes `ctx.object.position` or
`ctx.object.scale`, it overrides that fit transform. Only do this when the
effect intentionally owns model placement; otherwise leave fit position/scale to
the runtime and animate rotation, material, lights, animation, mesh handles, or
managed point layers.

When an effect needs model particles or generated model-local points, prefer
`ctx.object.model?.points.create(...)`. The runtime owns attachment, ordering,
and disposal through the returned managed handle. A future advanced object
attachment API must be designed separately instead of using raw Three.js objects
in the default public contract.

Do not mutate target internals that are not exposed by the handle.

## Resource Ownership

Effects may own:

- app-local plain JavaScript state created by the effect;
- event listeners created by the effect;
- runtime-managed handles returned by public APIs, such as material layers,
  model point layers, and postprocess request handles;
- per-effect mutable state.

Effects must not own:

- the renderer;
- the runtime;
- the runtime canvas;
- the main animation loop;
- global scroll/pointer systems;
- package-internal registries.
- raw Three.js renderer, scene, camera, shader material, texture, composer,
  geometry, mesh, light, loader, mixer, render target, render-loop, pass
  ordering, or renderer-state mutation.

If an effect mutates a source model's mesh visibility, material, rotation, scale,
or position, store previous values and restore them on dispose unless the effect
is explicitly the long-term owner of that mutation.

## Package Boundary

MUST:

- Treat the package as a reusable open-source runtime.
- Keep app-specific visual effects in the downstream application.
- Ask for a generic public API before relying on package internals.
- Keep DOM as the source for layout, content, accessibility, and interaction
  state.

DO NOT:

- Depend on example app code, example assets, example target keys, or workspace
  paths.
- Import private source files from the package.
- Add concrete app visual behavior to package core.
- Add CSS-to-WebGL browser paint cloning unless explicitly requested.
- Expose raw Three.js renderer flags as declaration API without package-level
  tests, docs, and compatibility decisions.

## Validation

Minimum for downstream integration:

```bash
npm run typecheck
npm test -- --run <changed-test-files>
```

When working in this repository:

```bash
npm test -- --run <changed-test-files>
npm run typecheck
npm run check:imports
git diff --check
npm run build
```

Effect-specific tests should cover:

- unknown effect kind fails at registration or is caught by tests;
- definition `kind` matches declaration `kind`;
- absent `ctx.object.*` capability modules no-op safely;
- `setup` creates resources once;
- `update` uses `ctx.delta` for motion;
- target-local pointer behavior reads `ctx.targetPointer`;
- text glyph pointer effects use `glyph.y + glyph.height / 2` for visual
  center proximity;
- transformed model picking accounts for current object transform;
- `dispose` releases effect-owned resources and restores source mutations.

Effect-specific behavior such as whether a hover animation decays while the
pointer is stationary, or whether all glyphs or only nearby glyphs react, belongs
to the consuming effect contract. Do not record those product choices as package
pitfalls unless they expose a reusable coordinate, lifecycle, or ownership bug.

## Dogfood Notes For Future Skills

Use this checklist when turning package usage experience into a reusable agent
skill:

- Confirm the target app first. `apps/example` is the downstream
  consumer/tutorial surface and the only app workspace. Do not add package API
  for an example-only visual tuning issue.
- Count runtime state before removing visuals. A page can register many targets
  while only a subset is active in the current viewport. Use debug state
  `targetCount` and `renderableCount` to distinguish "too many declarations"
  from "too much active per-frame work".
- Keep app visuals app-owned. Ghost Cursor, ReactBits-style effects, image
  assets, effect keys, copy such as `Boo!`, and shader tuning live in
  `apps/example`; packages should only gain generic capabilities such as
  controlled material layers or typed uniform data.
- For third-party visual ports, read the source implementation instead of
  iterating from screenshots once the user's target is named. Port the stable
  algorithm, not incidental infrastructure. For ReactBits Ghost Cursor, the
  reusable idea is pointer trail data plus `fbm`/`blob` shader math; the raw
  renderer/composer setup remains outside package public API. For ReactBits
  Waves, the active example now keeps the concrete visual in `apps/example` as a
  public material-layer shader approximation over the source texture rather than
  a package-owned effect or per-frame CPU canvas drawing. For ReactBits Text
  Pressure and Scrambled Text, use `dom/text` and
  `ctx.object.text.setGlyphs(...)` in `apps/example`; keep the exact
  behavior app-owned unless a later package feature explicitly needs a
  generalized text capability. When several text
  effects need to affect the same glyph command list, compose reusable
  app-owned glyph transform helpers into one effect, as
  `example.textSpotlightPressureScrambleWave` does for spotlight, pressure,
  scramble, and wave output.
- Shader coordinate systems are easy to invert. DOM pointer coordinates are
  top-down; shader UV-style coordinates are often bottom-up. Convert `y` at the
  effect boundary and add a regression test.
- Match shader uniform names exactly. If the shader reads `iTime`, updating only
  a legacy `uTime` uniform makes the visual look static even though the runtime
  is ticking.
- Avoid making product-taste feedback into package API. "Less light-like",
  "more smoke-line feel", or "more responsive hover" are example-level tuning
  unless they reveal a missing generic primitive or coordinate/lifecycle bug.
- Pointer-heavy effects need idle behavior only when frames become identical.
  Trail-based material effects can stop uniform updates after decay. Animated
  shader effects like `example.surfaceWaves` still update time uniforms while
  pointer-out because the ambient field keeps moving; do not cache them static
  just because the pointer left.
- Pointer-driven reveal effects that must preserve long strokes should keep
  accumulated shape in consumer-owned state such as a mask canvas texture rather
  than a bounded point-uniform window. Define stationary-hover semantics
  explicitly: if the pointer stops moving inside the target, decide whether the
  fade timer advances. When a user resumes movement during fade-out, bake the
  current fade into old mask content before drawing new full-strength strokes so
  partially restored areas do not snap back.
- If the user says they will do visual QA, do not claim browser visual
  verification. Run automated tests/typecheck/build as requested, and document
  visual QA as user-owned.
- When documenting a completed package capability, say what is controlled and
  what is intentionally not exposed. A capability is not complete if docs imply
  raw Three.js access or if examples appear to be package exports.

## Common Failures

- Unknown effect: target declares `{ kind: "x" }`, but runtime `effects` omits
  `defineWebGLEffect({ kind: "x" })`.
- Legacy object-form effects: use `effects: [{ kind: "app.effect" }]`, not
  `effects: { material, motion }`.
- Removed source declaration shape: target uses old top-level media kinds,
  `snapshot/mode`, or `model/format` instead of `kind` plus `type`.
- Runtime recreates in React: `effects` array identity changes on render.
- Pointer offset: effect compares runtime normalized pointer coordinates directly
  to target-local coordinates.
- Shader Y-axis inversion: effect passes DOM top-down pointer `y` into a
  bottom-up shader coordinate without conversion.
- Static shader after porting: effect updates `uTime` while the ported shader
  reads `iTime`, or otherwise mismatches public uniform names.
- Text effect vertical drift: effect treats `glyph.y` as a baseline and uses
  `glyph.y - glyph.height / 2`; glyph `y` is already the top drawing position.
- Draco model invisible or loader error: a compressed GLB declares no
  `loader.draco` config, or the app does not serve decoder files at
  `decoderPath`.
- Canvas becomes dim or blurry after one target is ready: an effect requested
  `ctx.object.postprocess` for what was actually a target-local glow. Current
  postprocess is runtime-canvas scoped.
- Model disappears after a glow/rotation effect: the effect writes
  `ctx.object.position` or `ctx.object.scale` and overrides the runtime's model
  fit transform.
- Rotating model interaction drift: effect hit-tests unrotated model-local
  vertices while visible model is transformed.
- Resource leak: effect creates objects/listeners without `ctx.resources`.
- Boundary violation: app imports package internals or example-only code.
- Hidden hardcoding: package source includes example/app effect keys, asset
  paths, copy, ReactBits/Ghost Cursor constants, or product-specific shader
  logic instead of a generic controlled primitive.

## Agent Completion Report

When finishing package usage or custom effect work, report:

- package entrypoints used;
- runtime registration location;
- target declaration location;
- effect kind(s);
- supported source kind(s);
- resource ownership and dispose behavior;
- tests and verification commands run;
- remaining visual tuning parameters, if any.
