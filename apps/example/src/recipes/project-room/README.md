# Project room

A four-wall spatial index, extracted from Hero Next's project chapter. The
component owns its content, navigation store, scene/pass declarations and text
atlas, including its scene's required default screen camera. The parent runtime owns rendering and disposal. No Hero, Next.js, GSAP,
raw Three.js or private asset dependency is retained.

## Copy and run

Copy this entire directory into a React app with `@viselora/dom-webgl` and
`@viselora/scroll-adapters` installed at `0.1.0-alpha.2` (or a compatible newer
version). CSS is imported by the component. Register `projectRoomEffects` once
on the existing runtime; the component creates no runtime or canvas.

```tsx
import React from "react";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import {
  ProjectRoom,
  projectRoomEffects,
  type ProjectRoomItems,
} from "./recipes/project-room";

const items = [
  {
    id: "archive",
    label: "COLLECTION",
    title: "Archive",
    description: "An index of our field notes.",
    href: "/archive",
  },
  {
    id: "studio",
    label: "PRACTICE",
    title: "Studio",
    description: "Tools and experiments in progress.",
    href: "/studio",
  },
  {
    id: "library",
    label: "READING",
    title: "Library",
    description: "Books that shaped the work.",
    href: "/library",
  },
  {
    id: "garden",
    label: "OBSERVATION",
    title: "Garden",
    description: "A space for slow discoveries.",
    href: "/garden",
  },
] satisfies ProjectRoomItems;

export default function Page() {
  return (
    <WebGLScrollRuntime effects={projectRoomEffects} smooth={false}>
      <ProjectRoom id="collection" items={items} title="Four viewpoints" />
    </WebGLScrollRuntime>
  );
}
```

When combining recipes, create the combined runtime effect array at module scope:
`const effects = [...existingEffects, ...projectRoomEffects]`. Use one runtime
for the page. Never add the same effect definition twice.

## Public contract

| Prop              | Contract                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | Required nonempty ID, unique within the parent runtime. Prefixes viewport, scene, pass and target IDs.                                                                         |
| `items`           | `ProjectRoomItems`: a readonly tuple of exactly four items, clockwise. Each requires a unique `id`, `label`, `title`, `description`, and real `href`; `linkLabel` is optional. |
| `title`           | Accessible section heading; defaults to `Project room`.                                                                                                                        |
| `palette`         | `{ background, foreground }`, both six-digit `#RRGGBB` colors. Defaults to dark green / warm white. Choose readable contrast.                                                  |
| `labels`          | Optional overrides for `hint`, `navigation`, `previous`, `next`, `visit`. Supply these for localization.                                                                       |
| `initialSelected` | `0`, `1`, `2`, or `3`; defaults to the first wall.                                                                                                                             |
| `className`       | Additional layout class. The root fills available width; minimum height is 520px.                                                                                              |

Content, labels, initial selection and palette are captured for one mount. To
replace them, remount with a different React `key`, for example
`<ProjectRoom key={locale} id="collection" items={localizedItems} />`. Keep
`id` unique even when rendering several rooms. `className` may change normally.
Do not animate or mutate `items` in place.

## Interaction and fallback

- A fine hover pointer and a component width of at least 680px enable the room.
  Narrow/touch layouts, loading, unavailable WebGL and atlas errors retain the
  complete DOM list with ordinary links.
- Moving from the center to an edge turns once; return to the center to rearm.
  The header/footer and focused controls are protected from accidental turns.
- Navigation buttons support Tab, Enter/Space, Left/Right, Home and End. The
  selected description is announced politely. The selected link is unavailable
  until the visual wall settles, preventing a link/content mismatch.
- Reduced motion keeps the room and direct selection, removing interpolation,
  automatic edge turns and pointer parallax. Links use normal same-tab navigation.
- The managed pass clips the shader to this component's DOM rect. No page-size
  assumption or application DOM query is used by the effect.
  The orthographic camera spans the runtime canvas; the effect fits its unit
  plane to that full camera frame before the pass maps it into the component.
  Keep the declared camera when adapting this recipe: a scene without a camera
  defers its pass even if the material layer has been created successfully.

## Read/change map and limits

Start with `types.ts` and `ProjectRoom.tsx`. `room.ts` owns navigation;
`ProjectRoomControls.tsx` owns semantic controls/fallback; `effect.ts` connects
target-local input to a managed material layer; `program.ts` casts rays through
a square room; `artwork.ts` packs four wall texts into one 2048×1440 alpha atlas.

The four-wall count is an explicit geometry constraint. This is not an arbitrary
N-item carousel. A wall has bounded typography capacity: a short heading and
paragraph work best. Overflow reports the offending item ID and preserves DOM
content; it is never silently truncated. External images/models, custom fonts,
scroll handoffs and Hero's endpoint atlas are outside this component's contract.
Unregistering/replacing the effect disposes its managed layer idempotently;
the runtime releases its GPU resources.

See the complete app composition in
[ProjectRoomDemo.tsx](../../recipe-demos/ProjectRoomDemo.tsx) and regression tests
in [projectRoom.test.ts](../../../test/recipes/projectRoom.test.ts) and
[projectRoomControls.test.tsx](../../../test/recipes/projectRoomControls.test.tsx).
