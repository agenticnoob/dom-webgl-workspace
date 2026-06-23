# Agent Contract: Custom Effects

Custom effect authoring is the public extension model for visual behavior.
Read `docs/agent/package-usage.md` first; this file focuses on decisions agents
must make while writing effect definitions.

## Boundary

- Effects are application-owned code.
- `@project/dom-webgl-runtime` exports authoring primitives, source handles,
  target handles, frame input, and managed resources.
- The package does not export concrete effects, preset effects, or
  `@project/dom-webgl-runtime/effects`.
- Example app effects live under `apps/example` and are copyable examples, not
  package API.
- Demo effects live under `apps/demo` and are demo validation code, not a
  downstream integration guide.

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
          source: { kind: "snapshot", mode: "text" },
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

Always narrow `ctx.source.kind` before using a source-specific handle:

```ts
if (ctx.source.kind !== "snapshot/text") {
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

- `snapshot/element`: draw or clear a canvas-backed surface.
- `snapshot/text`: rewrite WebGL output text or glyph commands.
- `image`: control image texture transform and invalidation.
- `video`: control texture transform, play/pause, muted state, and playback
  rate.
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

- Declare `image` only on real `img` targets.
- Declare `video` only on real `video` targets.
- Use `snapshot` for `div`, `section`, `p`, `span`, and other normal DOM
  targets.
- Put `snapshot/text` on the actual text-bearing element.
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
