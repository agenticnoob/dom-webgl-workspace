# Reusable visual recipes

Nine demonstrations extract Hero Next's visual behavior into six React modules.
They run together in the
[example app](https://github.com/agenticnoob/dom-webgl-workspace/tree/main/apps/example)
(`npm run dev -w @viselora/example`, then scroll `/`; `/#<id>` links to a row).
The consumer skill ships identical copies in `recipes/hero/`.
Recipes use React Three Fiber, Drei and Three.js directly. Viselora manages the
shared Canvas host, DOM fallback, progress and page lifecycle. These modules are
copied source, not exports from `@viselora/dom-webgl`.

| Demo ID                | Component / module                             | Input and behavior                                                                                          | Read first                                               |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `paper-reader`         | `PaperReader` / `paper-reader`                 | Ordered articles → circular index, perforated paper, reversible arrivals and overflow reading               | [Contract and example](./paper-reader/README.md)         |
| `project-room`         | `ProjectRoom` / `project-room`                 | Four projects → four perspective walls, edge turns, damped parallax and keyboard selection                  | [Contract and example](./project-room/README.md)         |
| `sculpture`            | `InteractiveSculpture` / `spatial`             | Copy, palette and motion → breathing, floating, pointer parallax, Fresnel edge light and pointer light      | [Contract and example](./spatial/README.md)              |
| `radial-theme`         | `InteractiveSculpture` / `spatial`             | Add `holdMs` → actual mesh hit, radial coverage, early release reversal and one committed scheme            | [Contract and example](./spatial/README.md)              |
| `model-story`          | `ModelStory` / `model-story`                   | GLB, bounding box, paragraphs and messages → one scroll turn, reversible typing and per-line text avoidance | [Contract and example](./model-story/README.md)          |
| `face-portal`          | `FacePortal` / `spatial`                       | Four chapters → face atlas, approach, screen lock, semantic DOM handoff and return                          | [Contract and example](./spatial/README.md)              |
| `relief-portal`        | `FacePortal` / `spatial`                       | Add GLB and framing → shallow face relief, expansion into the body and return to the same face              | [Contract and example](./spatial/README.md)              |
| `pointer-preview`      | `PointerPreviewDirectory` / `pointer-preview`  | Links and image URLs → pointer-following previews, keyboard access and full touch list; no WebGL required   | [Contract and example](./pointer-preview/README.md)      |
| `perspective-timeline` | `PerspectiveTimeline` / `perspective-timeline` | Ordered records → paired perspective text, scroll-speed flight, bounded target window and static reading    | [Contract and example](./perspective-timeline/README.md) |

## Shared host

Install React, Three.js, `@react-three/fiber`, `@react-three/drei`,
`react-error-boundary`, `@viselora/dom-webgl`, `@viselora/scroll-adapters`,
`lenis` and `gsap`.
Use the versions in this app's package.json. Next.js callers use a client component.
Each GPU recipe creates a Drei `View`; all Views render through one `View.Port`.
The page clears the shared canvas before the Views render:

```tsx
import type { ReactNode } from "react";
import { View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
// The skill's recipes/smoothScroll.ts: Lenis + GSAP smooth page scroll.
import { smoothScroll } from "./smoothScroll";

function ViewScene() {
  useFrame(({ gl, size }) => {
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor(0x000000, 0);
    gl.clear();
  }, 0);
  return <View.Port />;
}

export function VisualPage({ children }: { children: ReactNode }) {
  return (
    <WebGLScrollRuntime smooth={smoothScroll} scene={<ViewScene />} canvas={{ dpr: [1, 2] }}>
      {children}
    </WebGLScrollRuntime>
  );
}
```

The examples below each use this `VisualPage`. When a page already has the host,
mount the recipe inside it. Do not nest hosts or register an effect catalog.
The Canvas host is behind semantic DOM; enhanced viewport backgrounds must be
transparent. Drei performs per-View scissoring and event routing.

## Copy and adapt

1. Read the selected module's README and `index.ts`, then copy its whole directory.
2. Preserve its relative source layout and copy [shared/](./shared/) next to it:
   GPU recipes use `shared/nativeMaterials.ts` and `shared/useRuntimeReady.ts`;
   GLB recipes use `shared/useClonedModel.ts`.
3. Keep IDs unique. Change typed content first; remount components whose README
   specifies a mounted content contract when replacing that content.
4. Host public assets yourself. Provide real GLB bounds and semantic fallback.
   The GLB recipes accept `dracoPath`, passed directly to Drei `useGLTF`.
5. Check forward/reverse scrolling, actual canvas pixels, keyboard, narrow/touch
   layout, reduced motion, load failures and unmount.

R3F owns object reconciliation and frame scheduling. Three.js owns scene objects
and GPU resources. Components dispose textures and materials they allocate;
`useGLTF`/`useTexture` cache resources stay shared. Instance graph clones use
`dispose={null}` and clone materials before customization. Runtime does not
reimplement loaders, geometry, materials, mixers, physics or postprocessing.

Recipes combine scene readiness with `useRuntimeReady()` before replacing their
DOM fallback. Context loss restores readable content while the native scene and
its resources stay mounted for recovery.

The recipes measure native document scroll. Transformed smooth scrollers or
nested containers require an explicit integration. Hero's personal content,
preferences and whole-site chapter orchestration remain caller-owned.

## Verification

```bash
npm test -- --run apps/example/test/recipes
npm run typecheck -w @viselora/example
npm run build -w @viselora/example
npm run check:imports
```

Pure tests protect reversible geometry and handoffs. DOM tests cover semantic
fallback, preference changes and listener cleanup. R3F test-renderer tests drive
real Three.js scene objects and validate allocated texture/material disposal.
GPU output still needs browser review. Current evidence is recorded in the
[app verification record](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/apps/example/docs/verification.md).
