# Effect Authoring Examples Design

## Goal

Create a React-only downstream example app that validates the public DOM WebGL package documentation from a consumer perspective, without adding concrete effects to the runtime package or expanding `apps/demo`.

## Scope

- Document the package effect authoring contract before building the example.
- Add `apps/example` as a separate workspace app that imports only public package entrypoints.
- Apply the optional Lenis + GSAP + ScrollTrigger stack through the public
  `@project/dom-webgl-scroll-adapters` package.
- Implement small application-owned effects that cover the public source handles:
  `snapshot/element`, `snapshot/text`, `image`, `video`, and `model/glb`.
- Present the example page as a Chinese vertical effect catalog, one effect row
  per example, while keeping API identifiers such as effect kinds in English.
- Write a friction report after building the example, listing documentation gaps,
  counterintuitive API behavior, missing effect capabilities, and boundaries that
  should remain strict.

Out of scope:

- No vanilla runtime page in this pass.
- No changes to runtime package APIs unless the example exposes a blocking bug.
- No reuse of `apps/demo` code or assets as the example implementation model.
- No package-exported `effects` subpath or official concrete effect library.

## Architecture

`apps/example` is a normal Vite React app and acts like a downstream consumer. It registers effects through `<WebGLRuntime effects={...}>`, declares targets through `<WebGLTarget webgl={...}>`, keeps effect definitions in local app code, and passes the optional smooth-scroll stack to the runtime through `scrollAdapter`.

The runtime package remains primitive-only. The example effects use `defineWebGLEffect(...)`, source handles, target handles, and managed resources through public imports from `@project/dom-webgl-runtime` and `@project/dom-webgl-runtime/react`.

## Example App

The example app is a compact working page, not a marketing landing page. It
uses Chinese visible copy so local readers can scan the effect intent quickly,
while keeping public API identifiers and source kinds unchanged in code. The
page is a vertical catalog: each effect occupies one row with short explanatory
copy and one `WebGLTarget`.

- Element snapshot rows: `example.surfaceFill` and `example.surfacePulse`.
- Text snapshot rows: `example.textWave` and `example.textReveal`.
- Image rows: `example.imagePan` and `example.imageZoom`.
- Video rows: `example.videoPlayback` and `example.videoDrift`.
- Model rows: `example.modelSpin` and `example.modelFloat`.

The app may copy demo static assets from `apps/demo/public` into
`apps/example/public` for development convenience, but it must not depend on
`apps/demo/public` being served at runtime and must not import demo source code.

## Documentation

The documentation pass should make these points explicit:

- Concrete visual effects are application-owned.
- Target `effects` declarations are data only.
- Runtime-level `effects` registers executable definitions.
- React users must keep the `effects` array stable.
- Source handles must be narrowed by `ctx.source.kind`.
- Media declarations require real `img` and `video` elements.
- Effect-owned resources must be registered with `ctx.resources`.
- Example app imports must stay on public package entrypoints.

## Validation

The implementation must include focused tests for:

- example effects matching their declared source kinds;
- unsupported source kinds no-oping safely;
- React example registering a stable effect array through public components;
- the example app not importing demo source or runtime package internals.

Final verification:

```bash
npm test -- --run apps/example/src
npm run typecheck
npm run check:imports
npm run build
git diff --check
```
