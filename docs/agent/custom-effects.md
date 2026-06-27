# Agent Contract: Custom Effects

Custom effect authoring is the public extension model for visual behavior.
Read `docs/agent/package-onboarding.md` first when starting from zero, then use
`docs/agent/package-usage.md` for the full package contract. This file focuses
on decisions agents must make while writing effect definitions.

## Boundary

- Effects are application-owned code.
- `@project/dom-webgl-runtime` exports authoring primitives, source handles,
  target handles, frame input, and managed resources.
- The package does not export concrete effects, preset effects, or
  `@project/dom-webgl-runtime/effects`.
- Example app effects live under `apps/example` and are copyable examples, not
  package API.

## React Registration Pattern

Keep the executable effect definitions stable:

```tsx
import { WebGLRuntime, WebGLTarget } from "@project/dom-webgl-runtime/react";

import { exampleEffects } from "./exampleEffects";

export function App() {
  return (
    <WebGLRuntime effects={exampleEffects}>
      <WebGLTarget
        webgl={{
          key: "example.text",
          source: { kind: "dom", type: "text" },
          effects: [{ kind: "example.textWave", amplitude: 7 }],
        }}
      >
        Text remains DOM-authored.
      </WebGLTarget>
    </WebGLRuntime>
  );
}
```

Rules:

- Define `exampleEffects` at module scope, or memoize it if it must be built
  from configuration.
- `webgl.effects` is data only. It names the effect and carries params.
- Runtime-level `effects` is executable code. It must include a definition whose
  `kind` exactly matches every declared target effect kind.
- Use namespaced kinds such as `product.textWave`; avoid generic names such as
  `wave`, `fade`, or `particles`.

## Source Handles

Always narrow `ctx.source.kind` and `ctx.source.type` before using a
source-specific handle:

```ts
if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
  return;
}

ctx.source.textLayer?.setGlyphs((glyphs) =>
  glyphs.map((glyph) => ({
    index: glyph.index,
    char: glyph.char,
    y: glyph.y + Math.sin(ctx.time / 450 + glyph.index * 0.42) * 7,
  })),
);
```

Current handles:

- `dom/element`: draw or clear a canvas-backed surface.
- `dom/text`: rewrite WebGL output text or glyph commands.
- `media/image`: control image texture transform and invalidation.
- `media/video`: control texture transform, play/pause, muted state, and playback
  rate.
- `media/image-sequence`: control the current frame texture transform and invalidation.
- `model/glb`: inspect and control the runtime-owned model handle.

## Resource Ownership

Create expensive objects in `setup`, not `update`.

Use `ctx.resources.addDisposable(...)` for effect-owned listeners, object
handles, generated geometries, materials, textures, and source mutations that
must be restored.

Do not dispose or mutate:

- renderer;
- runtime;
- runtime canvas;
- global scroll or pointer systems;
- package-internal registries.

## Media And Target Rules

- Use `source: { kind: "media", type: "image" }` for image media.
- Use `source: { kind: "media", type: "video" }` for video media.
- Use `source: { kind: "dom", type: "element" | "text" }` for normal DOM
  targets.
- Put `dom/text` on the actual text-bearing element.
- Use `hideMode: "self"` for mixed DOM/WebGL panels.
- Use `hideMode: "subtree"` only when the entire subtree should be replaced by
  WebGL output.

## Validation Checklist

Effect tests should cover:

- definition `kind` matches declaration `kind`;
- unsupported source kinds no-op safely;
- numeric params are clamped;
- `setup` creates resources once;
- `update` uses `ctx.delta` or `ctx.time`, not frame counts;
- target-local pointer math maps through `ctx.layout`;
- `dispose` releases effect-owned resources and restores source mutations.

Repository verification:

```bash
npm test -- --run apps/example/src
npm run typecheck
npm run check:imports
npm run build
git diff --check
```

See `docs/examples/effect-authoring.md` and `apps/example` for the current
React-only consumer example.
