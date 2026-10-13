# Model story

`ModelStory` combines a GLB loaded by Drei, one reversible scroll turn, a fixed-size
type/hold/delete speech bubble, and text whose **rendered lines** move around
the model and bubble. Copy this entire directory into a React application.
It uses R3F, Drei, Three.js and public Viselora entrypoints. Copy the shared
helpers and use `VisualPage` from the [catalog](../README.md). Its native camera,
lights and cloned GLB graph live in a Drei View inside the shared Canvas.

## Complete minimal usage

Host a centered, unit-sized model at `public/models/object.glb`, or pass its
actual `framing` as described below. Install React and the matching
`@viselora/dom-webgl` and
`@viselora/scroll-adapters` packages.

```tsx
import React from "react";
import { VisualPage } from "./VisualPage"; // Shared host from the recipe catalog
import {
  ModelStory,
  type ModelStoryModel,
  type ModelStorySection,
} from "./recipes/model-story";

const model = {
  src: "/models/object.glb",
  description: "A carved wooden object with a curved back.",
  framing: { center: [0, 0, 0], size: [1, 1, 1] },
  poster: "/images/object.jpg",
} satisfies ModelStoryModel;

const sections = [
  {
    id: "front",
    heading: "Meet the object",
    side: "left",
    paragraphs: ["The front reveals a simple, balanced shape."],
  },
  {
    id: "back",
    heading: "Look a little closer",
    side: "right",
    paragraphs: ["The back carries the marks of its making."],
  },
] satisfies readonly ModelStorySection[];

const messages = {
  front: "Start with the front.",
  side: "Follow the curve.",
  back: "Notice the details.",
};

export function App() {
  return (
    <VisualPage>
      <ModelStory
        id="object-story"
        title="A closer look"
        model={model}
        sections={sections}
        messages={messages}
      />
    </VisualPage>
  );
}
```

Remove `poster` if unavailable; a text placeholder remains. Mount ModelStory
inside the existing shared host, with a unique ID for each simultaneous instance.

## Props and asset contract

| Prop                | Contract                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | Nonempty, unique in the runtime; scopes its progress and semantic DOM IDs.                                                                                                                                              |
| `title`             | Semantic heading for the story.                                                                                                                                                                                         |
| `model.src`         | App-hosted or CORS-accessible GLB URL. No loader callbacks.                                                                                                                                                             |
| `model.description` | Persistent semantic description; also the visual loading/error fallback.                                                                                                                                                |
| `model.poster`      | Optional public fallback image; failure to load the GLB never hides it.                                                                                                                                                 |
| `model.framing`     | GLB-root-space `center: [x,y,z]` and bounding-box `size: [width,height,depth]`, including the GLB's internal node transforms. Defaults to a centered unit cube. Values must be finite; each dimension must be positive. |
| `model.dracoPath`   | Optional decoder directory, passed directly to Drei `useGLTF`.                                                                                                                                                          |
| `sections`          | Ordered `{ id, heading, paragraphs, side: "left" \| "right" }` records; use stable unique section IDs and alternate sides for the demonstrated layout.                                                                  |
| `messages`          | Three complete strings: `{ front, side, back }`. Both side views share `side`.                                                                                                                                          |
| `className`         | Optional wrapper class for app-owned styling.                                                                                                                                                                           |

Get framing from your asset editor's exported bounding box. The recipe rotates
about that center, compensates for an off-center GLB origin, and fits all yaw
angles to the measured viewport. It does not inspect private geometry or create
a loader. The demo uses the existing public `hero.glb` (131,908 bytes), whose
one mesh and internal scale/translation have been checked. It needs no Draco,
texture, or animation dependencies. Personal Hero Next assets are not copied.

For Draco, host the complete compatible decoder directory at the declared URL
with a trailing slash. Remote models, decoders, and textures must allow your
origin via CORS. Decoder files and model provenance remain the application
owner's responsibility. No decoder CDN or credentials are embedded here.

## Behavior and accessibility

- Native page scroll maps story top/viewport top to `0` and story bottom/viewport
  bottom to `1`. No GSAP setup, wheel lock, pinning adapter, or animation timer is
  required. Embedded element scrollers are outside this recipe's contract.
- The exact same signal drives `-2π` yaw and front → side → back → side → front
  captions. Moving backwards retraces identical geometry and character counts.
  Caption layers share one grid cell, so all full messages reserve their size
  before any characters are hidden. Keep copy concise; long messages enlarge the
  bubble once during layout, never during typing.
- DOM owns text layout. Tokens are grouped by actual visual-line overlap; each
  line clears an ellipse and a rounded rectangle, within the story's outer
  gutters. This is line displacement, not text rasterization or CSS shape-outside.
  Ordinary words and CJK characters are supported; the supplied layout expects
  left-to-right text and moderate word lengths.
- Above 760 CSS pixels of component width, model and bubble share a sticky
  composition while the semantic columns scroll. Narrow containers show a
  normal model stage above a single-column article, keeping all copy readable.
- Browser `prefers-reduced-motion` changes are handled live: the model stays at
  the front and its complete front message remains visible. The narrative and
  expandable **Model captions** transcript remain available with or without
  WebGL. The animated character copies are hidden from assistive technology;
  they never announce every scroll tick.
- The containing page must leave the model viewport transparent so the runtime
  canvas can show through. Customize `--model-story-paper` and
  `--model-story-ink` on your wrapper to match the surrounding page.

Keep model, framing and content stable while mounted.
Changing the model, loader, messages, IDs, or recipe configuration requires a
new React `key`. Changing scroll position never causes React state updates.
Unmount disconnects resize/mutation/font/media/scroll listeners, cancels pending
measurement, removes line/character mutations, and clears the progress signal;
R3F removes its scene objects. The cloned graph retains useGLTF cache resources
through `dispose={null}`; it never disposes another instance's shared model.

## Read this when adapting

1. `ModelStory.tsx`: public props, semantic DOM, native R3F scene composition.
2. `frame.ts`: pure one-turn and reversible caption timeline.
3. `controller.ts`: scoped DOM measurement and progress publication.
4. `wrap.ts`: pure ellipse/rounded-rectangle line exclusion geometry.
5. `effect.ts`: pure framing validation and model transform.
6. `model-story.css`: responsive geometry and semantic typography.

Run `npm test -- --run apps/example/test/recipes/modelStory` and
`npm run typecheck -w @viselora/example` from the repository root. See
[ModelStoryDemo.tsx](../../recipe-demos/ModelStoryDemo.tsx) for a complete
checked-in asset example.
