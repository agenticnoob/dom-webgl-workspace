# Perspective timeline

`PerspectiveTimeline` extracts the final journal effect from the standalone
Hero Next site: paired text lanes travel from the horizon toward the reader,
while a tetrahedron banks, recedes, spins and gains Fresnel light in response
to scroll speed. Labels can be dates, releases, milestones or chapter names.

Copy this entire directory and the shared helpers in the [catalog](../README.md).
It uses React, R3F, Drei, Three.js and public Viselora APIs;
it needs no model, image, network request, Next.js route or journal service.
The [live example](../../recipe-demos/PerspectiveTimelineDemo.tsx) appears at
`/#perspective-timeline`, immediately after the pointer-preview row.

## Complete usage

Install the dependencies listed in the [shared host contract](../README.md#shared-host).

```tsx
import React from "react";
import { VisualPage } from "./VisualPage"; // Shared host from the recipe catalog
import {
  PerspectiveTimeline,
  type PerspectiveTimelineEntry,
} from "./recipes/perspective-timeline";

const entries = [
  {
    id: "release",
    label: "02 / Release",
    meta: "React · TypeScript",
    body: "The first version is ready. Every entry keeps its complete text.",
  },
  {
    id: "prototype",
    label: "01 / Prototype",
    meta: "Sketches · Experiments",
    body: "A small experiment became something worth sharing.",
  },
] satisfies readonly PerspectiveTimelineEntry[];

const labels = {
  read: "Read the full timeline",
  resume: "Return to perspective",
  empty: "No records yet.",
};

export function App() {
  return (
    <VisualPage>
      <PerspectiveTimeline
        id="release-history"
        title="A record in motion"
        description="Scroll forward or back through the milestones."
        entries={entries}
        labels={labels}
      />
    </VisualPage>
  );
}
```

Use the [shared host and helper layout](../README.md#shared-host). Each instance
owns a Drei View, native perspective camera, tetrahedron and a bounded set of
textured planes. A far background mesh keeps the enhanced DOM transparent.

## Input contract

| Prop                   | Contract                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | Nonempty and unique within the runtime; namespaces DOM IDs and progress signals.                                                                                        |
| `title`, `description` | Plain text for the semantic heading and instruction.                                                                                                                    |
| `entries`              | Ordered `{ id, label, meta, body }` records. Entry IDs must be nonempty and unique within this instance. Caller order is preserved; no sorting, truncation or fetching. |
| `labels`               | Caller-owned strings for `read`, `resume` and `empty`; all three are required.                                                                                          |
| `className`            | Optional wrapper class. Keep the animated viewport transparent.                                                                                                         |

Props describe one mounted composition. Keep them stable; replacing content, locale
or identity requires a new React `key`. This rebuilds its text atlas and scene together. `label` is display text, not an assumed ISO date. `meta` and
`body` preserve line breaks, and may be empty. Text is rendered as text, never HTML.

## Motion, layout and fallback

- Native document scroll maps the component top to `0` and its bottom to `1`.
  Left and right lanes use the same progress and depth, preserving their pairing
  on reversal. Taller records receive more distance between entries. Mixed CJK
  and Latin text and explicit line breaks contribute to the reserved height.
- At most 16 entries (48 native text planes) are mounted at once. React subscribes
  to the discrete window index, not each progress tick. R3F useFrame updates their
  transforms. Leaving the row removes the text window.
- Scroll speed is normalized by the original frame duration and viewport height.
  It changes mesh banking, scale, pullback, small vibration and Fresnel strength.
  Thrust damps after scrolling stops; the idle spin continues. The controller
  only measures DOM and publishes progress; it does not create an animation loop.
- Under 900px of component width, below 560px viewport height, with a coarse
  pointer, or with reduced motion, the component renders a complete static list
  and mounts no timeline scene or text planes. Preference changes apply
  live. This deliberately gives reduced-motion users the same reading fallback
  as mobile, rather than the original site's stationary record selector.
- The keyboard-accessible reading toggle provides the same list on desktop and
  returns to the start of the specimen when switching modes. It changes only
  this instance. The complete semantic list also exists for screen readers,
  server rendering and printing; animated duplicates are `aria-hidden`.
- Empty input renders the caller's status text without a scroll runway. Data
  loading, errors, pagination and retry remain with the caller. Resolve async
  data before mounting, or remount with its new content revision.
- Unmount cancels pending measurement, disconnects resize/media/scroll listeners,
  clears only this instance's signals and removes the material shader hook.
  R3F removes the scene objects, and text components dispose their own canvas
  textures.

The recipe assumes native document scrolling and left-to-right text. Nested or
transformed scrollers need an adapter. The spacing estimate is conservative for
the supplied Arial layout; custom fonts, unusually long unbreakable strings and
large datasets still need browser review. The desktop read button remains usable
if WebGL is unavailable; the semantic list remains visible until the native scene reports readiness.

## Source map for agents

| File                       | Responsibility                                                               |
| -------------------------- | ---------------------------------------------------------------------------- |
| `index.ts`                 | Public component and input types.                                            |
| `PerspectiveTimeline.tsx`  | Mounted input validation, layout mode, semantic content and reading control. |
| `TimelineScene.tsx`        | Drei View, native mesh/lights and bounded text planes.                       |
| `track.ts`                 | Pure spacing, progress, window selection and camera-space projection.        |
| `flight.ts`                | Pure speed normalization, damping and mesh motion.                           |
| `controller.ts`            | Scoped DOM measurements, progress publication and cleanup.                   |
| `effects.ts`               | Stage state and native material Fresnel shader hook.                         |
| `perspective-timeline.css` | Sticky viewport, source typography, static reading and print layout.         |

Run `npm test -- --run apps/example/test/recipes/perspectiveTimeline` and
`npm run typecheck -w @viselora/example` from the workspace root. Integration
and browser evidence live in [the app verification record](../../../docs/verification.md).
