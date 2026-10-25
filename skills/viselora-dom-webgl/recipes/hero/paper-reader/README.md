# PaperReader

A source-distributed React recipe extracted from Hero Next's circular article
reader. It preserves the circular title index, individually sized paper sheets,
reversible curved arrivals, postage perforations and overflow reading segments.
Article count controls the motion sequence, shader arrays, texture grid and
scroll distance. It contains no Hero content, application stores or Next.js code.

## Copy and run

Copy this entire `paper-reader/` directory into your application. The component
imports its own prefixed CSS. Install React 19.2 and the public Viselora packages:

```bash
npm install react react-dom three @react-three/fiber @react-three/drei react-error-boundary @viselora/dom-webgl @viselora/scroll-adapters
```

The recipe uses R3F, Drei and native Three.js textures/materials. No external image or font is required.
Use a bundler that supports CSS imports. In Next.js, import from a client component.

```tsx
import { VisualPage } from "./VisualPage"; // Shared host from the recipe catalog
import { PaperReader, type PaperReaderArticle } from "./paper-reader";

const articles = [
  {
    id: "observation",
    label: "01 / FIELD NOTE",
    title: "Begin with observation",
    body: "Watch how something is used before deciding how to change it.",
    paper: { width: 0.96, height: 0.8 },
  },
  {
    id: "experiment",
    label: "02 / FIELD NOTE",
    title: "Make the question tangible",
    body: "A small prototype gives everyone the same thing to discuss.",
  },
] satisfies readonly PaperReaderArticle[];

export function ReadingPage() {
  return (
    <VisualPage>
      <PaperReader id="field-notes" articles={articles} title="Field notes" />
    </VisualPage>
  );
}
```

Use the [shared VisualPage host](../README.md#shared-host) and copy the shared
`nativeMaterials.ts` and `useRuntimeReady.ts` helpers with this directory. Each reader owns one Drei View,
an orthographic camera and a native ShaderMaterial. Readers share the host Canvas
and require distinct IDs; no effect registration is needed.

## Props

| Prop                              | Contract                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                              | Required non-empty ID, unique across the shared runtime.                                                                                                              |
| `articles`                        | Ordered array of `{ id, label, title, body, paper? }`. Article IDs must be unique within the reader; body is plain text. Empty arrays show the semantic heading only. |
| `article.paper`                   | Optional `{ width, height }`, each greater than 0 and at most 1, relative to the available paper area. Omission cycles four extracted paper proportions.              |
| `title`, `description`, `eyebrow` | Heading copy. Keep it brief enough to leave space for the papers.                                                                                                     |
| `palette`                         | `{ background, foreground }`, both opaque six-digit hex colors. Default dark slate and warm paper. Choose readable contrast.                                          |
| `height`                          | CSS stage height, default `min(90svh, 820px)`; CSS enforces a 480px minimum.                                                                                          |
| `stickyTop`                       | Non-negative sticky offset in CSS pixels, default 0.                                                                                                                  |
| `className`                       | Additional wrapper class for width and outer layout.                                                                                                                  |
| `transcriptLabel`                 | Label of the native disclosure below the animation.                                                                                                                   |
| `onError`                         | Optional texture/layout/material error handler; text fallback is retained. Without a handler the error is logged.                                                     |

Declare content data outside React render when practical.
Changes to `id`, article data/order/count, heading copy or palette automatically
remount the internal scene and rebuild its shader and text atlas together.
Height and sticky offset respond to layout changes. Materials and atlas textures are replaced together on content/layout changes.

## Behavior and fallbacks

- Document scroll is measured against this reader's section and published to its
  own `useScrollEffectProgressStore` key. The sticky stage can occupy any container
  width; shader geometry uses the View dimensions. The component supplies its own
  orthographic camera; Drei clips its unit plane to the stage rectangle.
  Use normal page scrolling, with no ancestor that clips or replaces sticky scroll.
  Nested scroll containers and transform-based scroll systems need a custom adapter.
- Only overflowing text adds a reading interval. Later papers remain outside the
  viewport until arrival; older papers retain their resting size beneath the stack.
  Reversing progress retraces the same geometry and text offset.
- All articles remain ordinary HTML. Before WebGL is ready, when WebGL creation
  fails, or when reduced motion is requested, the full transcript is the main view.
  After enhancement, a keyboard-accessible native disclosure below the scroll
  sequence contains the full transcript. Text is selectable there.
- Media preference listeners, scroll listeners, progress keys, resize observers,
  native materials and atlas textures are cleaned up when
  unmounted. A reduced-motion preference change removes the animated stage.
- The original atlas is capped at 4096px per dimension. More articles and very long
  text lower effective texture resolution; large counts also consume more fragment
  uniforms. The recipe has no fixed article-count branch, but hardware limits still
  apply. Use editorial collections, not an unbounded document feed. DOM text remains
  available when GPU support is absent; GPU shader compilation failures still need
  to be monitored through the host runtime's debug reporting.
- Canvas typesetting uses Arial/Helvetica/sans-serif and wraps English and CJK text.
  This is a plain-text reader, without rich-text markup, inline links or embedded media.
  A stage too short for its heading returns to text with a reported error.

## Source map for agents

| File                                   | Change here when…                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PaperReader.tsx`, `scroll.ts`         | Changing DOM semantics, host composition, sticky layout or progress measurement.                                         |
| `model.ts`, `config.ts`                | Changing props, validation, default proportions or presentation constants.                                           |
| `layout.ts`, `frame.ts`                | Changing responsive geometry, circular index, arrivals or reading intervals. Pure functions; preserve reversibility. |
| `artwork.ts`, `typography.ts`          | Changing plain-text typesetting or heading/paper content.                                                            |
| `texture.ts`, `program.ts`, `stamp.ts` | Changing atlas packing, GPU composition or perforation geometry. Preserve tile-origin alignment.                     |
| `PaperReaderSurface.tsx`               | Native material creation, per-View layout updates, progress and disposal.                                            |

Run the focused recipe tests from the workspace root:

```bash
npm test -- --run apps/example/test/recipes/paperReader
```
