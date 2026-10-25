# Project room

A four-wall spatial index with semantic links, an app-owned navigation store and
one text atlas. A native ShaderMaterial draws the room in a Drei View.

## Copy and run

Copy this directory, `nativeMaterials.ts` and `useRuntimeReady.ts` as described in the
[recipe catalog](../README.md). Use its shared `VisualPage` host, with React,
R3F, Drei, Three.js and the public Viselora packages. The component imports its CSS
and creates no additional Canvas.

```tsx
import React from "react";
import { VisualPage } from "./VisualPage"; // Shared host from the recipe catalog
import { ProjectRoom, type ProjectRoomItems } from "./recipes/project-room";

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
    <VisualPage>
      <ProjectRoom id="collection" items={items} title="Four viewpoints" />
    </VisualPage>
  );
}
```

Mount several rooms or other recipes inside one `VisualPage`; every room keeps
its own state and View, and uses a unique ID.

## Public contract

| Prop              | Contract                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | Required nonempty ID, unique within the parent runtime. Prefixes the viewport and semantic control IDs.                                                                        |
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
- Drei clips the native plane to this component's DOM rect. Its orthographic
  camera uses a fixed unit plane; shader uniforms use the View dimensions.

## Read/change map and limits

Start with `types.ts` and `ProjectRoom.tsx`. `room.ts` owns navigation;
`ProjectRoomControls.tsx` owns semantic controls/fallback; `ProjectRoomSurface.tsx` connects
R3F pointer input to its native ShaderMaterial; `program.ts` casts rays through
a square room; `artwork.ts` packs four wall texts into one 2048×1440 alpha atlas.

The four-wall count is an explicit geometry constraint. This is not an arbitrary
N-item carousel. A wall has bounded typography capacity: a short heading and
paragraph work best. Overflow reports the offending item ID and preserves DOM
content; it is never silently truncated. External images/models, custom fonts,
scroll handoffs and Hero's endpoint atlas are outside this component's contract.
Unmount disposes the component-owned atlas texture and material and releases
preference listeners; the DOM navigation store remains independent of GPU readiness.

See the complete app composition in
[ProjectRoomDemo.tsx](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/apps/example/src/recipe-demos/ProjectRoomDemo.tsx) and regression tests
in [projectRoom.test.ts](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/apps/example/test/recipes/projectRoom.test.ts) and
[projectRoomControls.test.tsx](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/apps/example/test/recipes/projectRoomControls.test.tsx).
