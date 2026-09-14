# Reusable visual recipes

Eight live demonstrations extract the visual behavior of Hero Next into five
source-distributed React modules. Open `/` in the example app and scroll through
the basic effects and all eight recipes on the same page. `/#<id>` links to a row;
every row is rendered directly without a selection page.

These are **app-level components built on the public alpha.2 APIs**. They are not
new exports from `@viselora/dom-webgl`, and do not import Hero Next, Next.js,
private content, or package internals. Copy a whole module directory to reuse it.
The compositions in [../recipe-demos/](../recipe-demos/) provide complete demo data
and component props. They mount inside the existing page runtime, without wrappers.
[../RecipeExamples.tsx](../RecipeExamples.tsx) assembles all eight rows and exports
one stable effect list, registered alongside the basic effects in `App.tsx`;
[the catalog](./catalog.ts) provides a data-only index for agents and tooling.

## Choose a component

| Demo ID           | Component / module                            | Input and behavior                                                                                          | Read first                                          |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `paper-reader`    | `PaperReader` / `paper-reader`                | Ordered articles → circular index, perforated paper, reversible arrivals and overflow reading               | [Contract and example](./paper-reader/README.md)    |
| `project-room`    | `ProjectRoom` / `project-room`                | Four projects → four perspective walls, edge turns, damped parallax and keyboard selection                  | [Contract and example](./project-room/README.md)    |
| `sculpture`       | `InteractiveSculpture` / `spatial`            | Copy, palette and motion → breathing, floating, pointer parallax, Fresnel edge light and pointer light      | [Contract and example](./spatial/README.md)         |
| `radial-theme`    | `InteractiveSculpture` / `spatial`            | Add `holdMs` → actual mesh hit, radial coverage, early release reversal and one committed scheme            | [Contract and example](./spatial/README.md)         |
| `model-story`     | `ModelStory` / `model-story`                  | GLB, bounding box, paragraphs and messages → one scroll turn, reversible typing and per-line text avoidance | [Contract and example](./model-story/README.md)     |
| `face-portal`     | `FacePortal` / `spatial`                      | Four chapters → face atlas, approach, screen lock, semantic DOM handoff and return                          | [Contract and example](./spatial/README.md)         |
| `relief-portal`   | `FacePortal` / `spatial`                      | Add GLB and framing → shallow face relief, expansion into the body and return to the same face              | [Contract and example](./spatial/README.md)         |
| `pointer-preview` | `PointerPreviewDirectory` / `pointer-preview` | Links and image URLs → pointer-following previews, keyboard access and full touch list; no WebGL required   | [Contract and example](./pointer-preview/README.md) |

## Agent integration procedure

1. Select by behavior in the table. Read that module's README and `index.ts`.
2. Copy the **whole module**, including CSS and its pure geometry/text helpers.
   Change the typed data first; the shader usually needs no edits.
3. Use React with `@viselora/dom-webgl@0.1.0-alpha.2` and
   `@viselora/scroll-adapters@0.1.0-alpha.2`. Reuse an existing
   `WebGLScrollRuntime`; register each required effect array exactly once.
4. Give simultaneous instances unique IDs. Keep effect arrays and mounted source,
   material and effect declarations stable. Read each module's update contract;
   use a new component key when replacing a declaration.
5. Host your own public assets. Provide actual GLB bounds and a semantic
   description/poster where supported. For Draco, declare
   `loader.draco.decoderPath`; never supply loader callbacks.
6. Verify real canvas output, forward/reverse scrolling, keyboard, narrow/touch
   layout, reduced motion, fallback and unmount. A ready flag alone does not prove
   that a scoped pass has rendered. Keep its matching camera and viewport.

For multiple WebGL recipes, combine their definitions at module scope:

```tsx
import React from "react";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { paperReaderEffects } from "./recipes/paper-reader";
import { projectRoomEffects } from "./recipes/project-room";
import { modelStoryEffects } from "./recipes/model-story";
import { spatialEffects } from "./recipes/spatial";

const effects = [
  ...paperReaderEffects,
  ...projectRoomEffects,
  ...modelStoryEffects,
  ...spatialEffects,
];

export function VisualPage({ children }: { children: React.ReactNode }) {
  return <WebGLScrollRuntime effects={effects}>{children}</WebGLScrollRuntime>;
}
```

Import only the modules the page uses. Do not nest a runtime inside a recipe.
The runtime owns the single renderer, canvas, render loop, loaders and GPU
resources; recipes own their DOM, data, geometry calculations and visual intent.
The scroll recipes currently measure native document scrolling. A transformed
smooth-scroll or nested scroll container requires an explicit adapter.

Hero's bilingual copy, local-storage preferences, personal links, private model,
and whole-site chapter orchestration are intentionally caller-owned data and
composition. These modules demonstrate the extracted effects with neutral
content and existing public example assets.

## Verify changes

From the workspace root:

```bash
npm test -- --run apps/example/test/recipes
npm run typecheck -w @viselora/example
npm run build -w @viselora/example
npm run check:imports
```

Pure frame/geometry tests protect reversibility and handoffs; component tests
cover semantics, registrations and lifecycle. Browser review is also required
for shader output, clipping, legibility and DOM/atlas alignment.

Latest automation, browser coverage and limitations are owned by the
[app verification record](../../docs/verification.md).
