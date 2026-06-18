# Codex Web Reference Learnings

Date: 2026-06-18

## Purpose

This document records the parts of `/Users/ai/AgentWorkspace/projects/codex-web`
that are useful as reference material for this open-source DOM-first WebGL
runtime.

The goal is not to copy the app-specific implementation. The goal is to preserve
the reusable architecture lessons that apply to this package.

## Current Reference Truth

`codex-web` is useful because it already separated a DOM-authored WebGL runtime
into clear areas:

- Core runtime infrastructure.
- React adapter ergonomics.
- Effect package surface.
- App-specific glue.
- Agent-facing integration and package boundary documentation.

The current reference is still app-local source in `src/lib/webgl-scroll/`.
It is not a complete html-to-canvas implementation, and its app page should not
be treated as package API precedent.

## Reusable Package Boundary

The most important reusable idea is the package boundary.

For this repo, keep the same separation:

- `core` owns DOM target registration, descriptor normalization, source
  descriptors, renderer lifecycle, resource lifecycle, layout projection,
  debug state, fallback visibility, and snapshot adapter contracts.
- `react` only provides adapter ergonomics such as `WebGLRuntime`,
  `WebGLTarget`, context, and hooks.
- Future `effects` consume runtime-owned source descriptors and renderables.
  Effects must not scan DOM independently or create a separate resource
  pipeline.
- Demo apps only declare targets and validate behavior. They must not fix
  runtime fidelity by hard-coding DOM structure, CSS overrides, or Three.js
  render internals.

This boundary directly supports an open-source package because non-React users,
framework adapters, and tests can all share the same core runtime contract.

## DOM Contract Lesson

`codex-web` uses React components as a thin way to author a DOM contract. The
important part is not React itself; the important part is that page code declares
ordinary DOM anchors and the runtime compiles them.

For this repo, the public `webgl` declaration object remains the preferred
contract:

```tsx
<WebGLTarget
  as="h2"
  webgl={{
    key: "hero.title",
    source: { kind: "snapshot", capture: "text" },
    lifecycle: { hideWhenReady: true }
  }}
>
  Snapshot
</WebGLTarget>
```

The runtime should infer common source kinds from DOM where possible, but the
compiled shape should still be a normalized source descriptor.

## Source Descriptor Lesson

`codex-web` has a useful source descriptor model:

- `snapshot/text`
- `snapshot/element`
- `image`
- `video`
- `model/glb`

This repo already has the same product direction. The next important step is to
make snapshot capture a first-class source pipeline instead of burying canvas
drawing inside individual renderables.

Recommended internal direction:

```ts
type DomSnapshot = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  dispose(): void;
};

type DomSnapshotAdapter = {
  capture(
    element: HTMLElement,
    options: {
      pixelRatio: number;
      backgroundColor?: string;
      signal?: AbortSignal;
    }
  ): Promise<DomSnapshot>;
};
```

The runtime should consume `DomSnapshotAdapter`, build a `CanvasTexture`, and
own layout/visibility/resource disposal. The adapter owns DOM-to-canvas capture
fidelity.

## html-to-canvas Direction

Do not keep expanding handwritten CSS mapping as the main implementation. It
will become a hard-coded demo renderer and will not match real DOM/CSS.

The package-ready direction is:

```txt
DOM element
  -> source descriptor
  -> snapshot adapter capture
  -> canvas bitmap
  -> CanvasTexture
  -> runtime-owned scene object
```

The default snapshot adapter can use a `foreignObject`-based strategy:

```txt
clone DOM subtree
  -> copy computed styles and pseudo-elements where needed
  -> inline fonts and image assets when possible
  -> serialize inside SVG foreignObject
  -> draw SVG image into canvas
  -> return canvas snapshot
```

Third-party implementations such as html-to-image, modern-screenshot, or
dom-to-image-more can be wrapped behind the same adapter contract. They should
not become assumptions throughout core runtime code.

Keep the current text canvas path only as a basic fallback or optimized text
adapter. It should not be the primary CSS fidelity story for element snapshots.

## Default Renderable Factory Lesson

`codex-web` routes source descriptors through a default renderable factory.
That shape is worth preserving here:

```txt
source descriptor
  -> renderable factory
  -> snapshot/image/video/model renderable
  -> common scene object contract
```

For this repo, keep renderables responsible for:

- Owning Three.js object, geometry, material, and texture resources.
- Updating layout from measured DOM rects.
- Reporting readiness and visibility state.
- Disposing deterministically.

Keep source capture and asset loading behind injected or runtime-owned service
boundaries so renderables do not each invent their own DOM scanning or network
pipeline.

## Fallback Visibility Lesson

The useful behavior from `codex-web` is readiness-gated fallback visibility:

- DOM fallback stays visible while a WebGL renderable is loading.
- DOM fallback hides only after the matching WebGL scene object is ready.
- Runtime disposal or target unregister restores fallback visibility.

This repo already follows that direction. Future snapshot adapter work must keep
that invariant: failed or pending DOM snapshot capture must not hide the
semantic DOM fallback.

## Debug And Boundary Tests

`codex-web` treats package boundary as a testable contract. This repo should do
the same.

Useful tests to keep or add:

- Public entrypoints export only stable package API.
- Demo imports only public package entrypoints.
- React adapter does not import renderer internals unnecessarily.
- Core stays free of React and app-specific content.
- Snapshot adapter can be replaced by an injected adapter in tests.
- Failed snapshot capture keeps fallback DOM visible and reports debug error
  state.

These tests are more valuable for an open-source package than visual fixes in a
single demo page.

## What Not To Borrow

Do not borrow these as future API precedent:

- App-specific page glue, brand content, or asset choices.
- Archived effects.
- Direct Lenis, GSAP, or ScrollTrigger ownership inside core.
- Snapshot text drawing as the full html-to-canvas solution.
- Demo-level CSS or DOM rewrites to hide runtime fidelity gaps.
- Public exposure of Three.js `renderOrder`, `transparent`, `depthWrite`, or
  canvas placement flags.

## Practical Next Steps

Recommended follow-up sequence:

1. Add a `DomSnapshotAdapter` interface in core.
2. Route `element` and `text` snapshot renderables through the adapter.
3. Keep the existing text canvas implementation as a default fallback adapter
   for text-only snapshots.
4. Add a `foreignObject` snapshot adapter behind the same interface.
5. Add tests for adapter injection, dirty invalidation, fallback visibility, and
   failed capture behavior.
6. Document optional third-party adapter packages without hard-binding them to
   the core runtime.

The high-level rule: demo pages declare DOM targets; package runtime owns the
pipeline; adapters own capture fidelity.
