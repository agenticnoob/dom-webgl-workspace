# PaperReader

A source-distributed React recipe extracted from Hero Next's circular article
reader. It preserves the circular title index, individually sized paper sheets,
reversible curved arrivals, postage perforations and overflow reading segments.
Article count controls the motion sequence, shader arrays, texture grid and
scroll distance. It contains no Hero content, application stores or Next.js code.

## Copy and run

Copy this entire `paper-reader/` directory into your application. The component
imports its own prefixed CSS. Install React 19 and the public Viselora packages:

```bash
npm install react react-dom @viselora/dom-webgl@0.1.0-alpha.2 @viselora/scroll-adapters@0.1.0-alpha.2
```

No GSAP, Lenis, Three.js import, external image, or font download is required.
Use a bundler that supports CSS imports. In Next.js, import from a client component.

```tsx
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import {
  PaperReader,
  paperReaderEffects,
  type PaperReaderArticle,
} from "./paper-reader";

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
    <WebGLScrollRuntime effects={paperReaderEffects}>
      <PaperReader id="field-notes" articles={articles} title="Field notes" />
    </WebGLScrollRuntime>
  );
}
```

If the page already has a `WebGLScrollRuntime`, add `...paperReaderEffects` to
its existing effect array **outside React render**, and mount `PaperReader`
inside that runtime. The recipe creates one managed DOM surface and a scoped
scene/camera/pass; it never creates a runtime, WebGL canvas, render loop or renderer.
Multiple readers use the same canvas and require distinct `id` values.

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

Declare data and combined effect arrays outside React render when practical.
Changes to `id`, article data/order/count, heading copy or palette automatically
remount the internal target and rebuild its shader and text atlas together.
Height and sticky offset respond to layout changes. Do not mutate effect
declarations or material programs after mounting. When composing the lower-level
files directly, remount your target with a new React key for declaration changes.

## Behavior and fallbacks

- Document scroll is measured against this reader's section and published to its
  own `useScrollEffectProgressStore` key. The sticky stage can occupy any container
  width; shader geometry uses `ctx.layout.width/height`, never the window width.
  The component registers a matching orthographic camera for its scoped pass; the
  effect fills that camera plane before the pass maps it onto the stage rectangle.
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
  managed material layers and uploaded texture references are cleaned up when
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
| `PaperReader.tsx`, `scroll.ts`         | Changing DOM semantics, registration, sticky layout or progress measurement.                                         |
| `model.ts`, `config.ts`                | Changing props, validation, default proportions or presentation constants.                                           |
| `layout.ts`, `frame.ts`                | Changing responsive geometry, circular index, arrivals or reading intervals. Pure functions; preserve reversibility. |
| `artwork.ts`, `typography.ts`          | Changing plain-text typesetting or heading/paper content.                                                            |
| `texture.ts`, `program.ts`, `stamp.ts` | Changing atlas packing, GPU composition or perforation geometry. Preserve tile-origin alignment.                     |
| `effect.ts`                            | Changing managed material creation, scoped layout updates or disposal. Use only public effect facades.               |

Run the focused recipe tests from the workspace root:

```bash
npm test -- --run apps/example/test/recipes/paperReader
```
