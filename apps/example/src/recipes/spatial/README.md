# Spatial sculpture and face portals

Copy this entire directory. Import `InteractiveSculpture`, `FacePortal`,
`spatialEffects` and their data types from `index.ts`. The components register a
scoped scene, perspective camera and DOM-sized pass inside an **existing**
`WebGLScrollRuntime`; they do not create another runtime or canvas.

## Minimal sculpture

```tsx
import React from "react";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { InteractiveSculpture, spatialEffects } from "./recipes/spatial";

const palette = { background: "#e9e4d6", foreground: "#172124" };
const motion = { breathing: 0.012, floating: 0.025, parallax: 0.12 };

export function Sculpture() {
  return (
    <WebGLScrollRuntime effects={spatialEffects}>
      <InteractiveSculpture
        id="studio.sculpture"
        title="Explore a different viewpoint"
        description="Move the pointer, or hold the object to change the palette."
        palette={palette}
        motion={motion}
        holdMs={1000}
      />
    </WebGLScrollRuntime>
  );
}
```

Omit `holdMs` for motion/light only. A positive `holdMs` enables the radial theme
transition and its keyboard-accessible button. Only a real mesh hit starts a
pointer hold. A restrained tremor accompanies the hold. Early release retracts the circle; full coverage commits once and
waits for release before allowing another commit. `onSchemeChange` receives
`0 | 1`; persistence belongs to the caller. `height` defaults to
`min(900px, 100svh)` with a 440px minimum.

`motion` optionally declares `breathing`, `floating`, `parallax`, `dampingMs`,
`rimStrength`, `pointerLight` and `holdShake` (default 1; 0 disables the hold tremor). These are visual amplitudes (scene units or
radians), damping in milliseconds, and light strengths. Defaults retain the
original restrained motion. Reduced motion disables ambient/parallax movement
and the animated circle; a completed hold or button click changes the scheme.

## Minimal four-face portal

```tsx
import React from "react";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import {
  FacePortal,
  spatialEffects,
  type FourFaces,
  type PortalChapter,
} from "./recipes/spatial";

const chapters = [
  {
    id: "observe",
    entry: {
      label: "01",
      title: "Observe",
      description: "Start with something concrete.",
    },
  },
  {
    id: "ask",
    entry: {
      label: "02",
      title: "Ask",
      description: "Give a question some space.",
    },
  },
  {
    id: "make",
    entry: {
      label: "03",
      title: "Make",
      description: "Build something you can examine.",
    },
  },
  {
    id: "share",
    entry: {
      label: "04",
      title: "Share",
      description: "Let another viewpoint in.",
    },
  },
] satisfies FourFaces<PortalChapter>;

export function Chapters() {
  return (
    <WebGLScrollRuntime effects={spatialEffects}>
      <FacePortal id="studio.chapters" chapters={chapters} />
    </WebGLScrollRuntime>
  );
}
```

Exactly four unique chapters match the four tetrahedron faces. Each chapter can
also provide `paragraphs`, an `exit` panel with the same shape as `entry`, and a
native `link: { href, label }`. Keep endpoint titles and descriptions concise:
the atlas and semantic panel share fixed viewport-based composition, not an
unbounded rich-text layout. Longer copy belongs in `paragraphs`.
If prose or a link is present without `exit`, the ending panel reuses `entry`.
Links belong to the middle content so the final viewport still matches its atlas.

`entryScreens` and `exitScreens` are positive viewport-height multiples, default
2.6 and 2. The entire approach/lock/reveal/DOM/contract/return path is derived from
native scroll position; scrolling backward retraces the same path. The complete
text control bypasses the long runways at any time. No animation is needed to
access the content or links.

For the floating relief, add a stable `model` declaration:

```tsx
const model = {
  src: "/models/object.glb",
  center: [0, 0, 0],
  size: 1,
  face: 0,
  bodyScale: 1.3,
} satisfies import("./recipes/spatial").ReliefModel;
```

Pass `model={model}` to `FacePortal`. `center` is the exported GLB-root-space
bounding-box center (including its internal transforms); `size` is its largest
bounding-box dimension. Both default to a centered unit object. `face` is
`0 | 1 | 2 | 3`. `bodyScale` changes its expanded size. Draco uses the public
`loader.draco.decoderPath` declaration. Use your own public asset. Loading or
model failure does not remove chapter text. The relief shares the same scene,
camera and pass as the tetrahedron; projection compensation preserves its
screen position as it leaves the shallow face plane.

## Declaration and accessibility contract

- IDs must be nonempty and unique in the host runtime.
- Keep `chapters`, `palette`, `motion`, `model` and effect arrays stable. When
  replacing content, framing, palette or effect parameters, remount the component
  with a new `key`. The runtime's mounted declarations are immutable.
- `palette` is a pair of contrasting CSS colors; opaque hex colors are simplest.
- No window/document access occurs during module import or server rendering.
  Semantic headings, paragraphs, links and controls remain available without GPU
  enhancement. Text atlas creation happens only in the runtime effect.
- The atlas is bounded to 4096px per dimension; narrow or large screens trade
  text resolution for a bounded texture. It uses Arial/sans-serif plain text.
- Reduced motion removes idle motion. The explicit portal scroll remains
  reversible; the complete-text button provides immediate reading without it.
- Use document scroll and avoid an ancestor that clips sticky positioning.
  Keep the recipe's matching camera/pass and a transparent enhanced DOM layer.
  Pointer offsets use viewport CSS pixels, matching the runtime's fixed canvas;
  a scrolling host container must not be subtracted from those coordinates.
- Do not add a Three renderer, loader, animation loop, ground plane or shadow
  renderer. The runtime owns GPU disposal; effects remove their managed shader
  and light handles, and the component clears its observers and progress keys.

## Source map for agents

| Change                                                 | Files                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Props, semantic content, fallback and reading control  | `InteractiveSculpture.tsx`, `FacePortal.tsx`, `types.ts`, `spatial.css` |
| Native scroll measurement and instance state           | `stage.ts`                                                              |
| Reversible phases and hold/release state               | `frame.ts`                                                              |
| Camera alignment and tetrahedron projection            | `geometry.ts`, `math.ts`, `config.ts`                                   |
| Matching endpoint typography and texture packing       | `atlas.ts`                                                              |
| UV-to-screen lock, theme circle and edge light         | `shader.ts`, `effects.ts`                                               |
| Model face/body transform and off-center normalization | `relief.ts`                                                             |
| Public scene/camera/pass/mesh/model declarations       | `SpatialScene.tsx`                                                      |

Run `npm test -- --run apps/example/test/recipes/spatial` after changing geometry
or lifecycle, then review desktop/mobile forward and reverse handoffs in the
browser. The two portal demos and two sculpture demos in
[../../recipe-demos/SpatialDemos.tsx](../../recipe-demos/SpatialDemos.tsx) are
complete consumers.
