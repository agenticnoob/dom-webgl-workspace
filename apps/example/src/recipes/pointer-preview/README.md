# Pointer preview directory

A DOM companion extracted from Hero Next's fourth chapter: semantic linked rows,
continuous pointer previews, keyboard previews and complete inline content on
touch/narrow layouts. It works independently of Viselora and needs only React.
There is no Next.js image component, WebGL canvas or asset registry.

## Copy and run

Copy this entire directory into a React app. The component imports its local CSS.

```tsx
import React from "react";
import {
  PointerPreviewDirectory,
  type PointerPreviewItem,
} from "./recipes/pointer-preview";

const items = [
  {
    id: "notes",
    title: "Field notes",
    detail: "Research / Observations",
    label: "Reading",
    description: "A collection of observations from ongoing work.",
    href: "/notes",
  },
  {
    id: "images",
    title: "Image archive",
    description: "Browse the full collection of image studies.",
    href: "/images",
    image: {
      src: "/images/study.jpg",
      alt: "A material study",
      width: 800,
      height: 600,
    },
  },
] satisfies readonly PointerPreviewItem[];

export default function Page() {
  return <PointerPreviewDirectory items={items} title="Elsewhere" />;
}
```

Replace the sample paths with existing destinations and supply your own images.
An item without `image` gets a text preview. Keep source dimensions correct to
reserve space and preserve aspect ratio.

## Public contract

| Prop                   | Contract                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `items`                | Readonly list of `PointerPreviewItem`; each requires unique `id`, `title`, `description`, and a real `href`. |
| Item `detail`, `label` | Optional row detail and preview eyebrow.                                                                     |
| Item `image`           | Optional `{ src, alt, width, height }`, rendered with native `img`.                                          |
| `id`                   | Optional section ID; a stable React `useId()` is used otherwise.                                             |
| `title`                | Section heading; defaults to `Directory`.                                                                    |
| `intro`, `footer`      | Optional plain-text context above/below the rows.                                                            |
| `className`            | Additional layout class. The component fills its parent width.                                               |

These are normal React props: replace the
items array to update content without remounting. Preserve IDs for the same
entries; change IDs when replacing their identity. No item data is persisted.

## Interaction, accessibility and limits

- Hover previews require a fine hover pointer and component width ≥680px.
  Touch events never open a preview. All descriptions and images are available
  inline before enhancement and on narrow/coarse-pointer layouts.
- The preview follows the complete row, including its empty space and arrow.
  Pointer moves share one scheduled DOM update per frame. Position is clamped
  continuously inside the component; it never jumps across the pointer.
- Keyboard focus opens a stationary preview. Escape, blur, click or leaving the
  directory dismisses it. Links remain ordinary same-tab links; the floating
  preview is decorative and never intercepts input.
- Reduced motion opens a stationary preview and disables eased following.
  Descriptions remain in the accessibility tree, and each link references its
  description. Native inline images retain supplied alternative text.
- Resize and input-capability changes restore the appropriate layout. Scroll
  keeps the pointer preview only if the same row remains under the pointer.
  Unmount cancels pending animation work and releases listeners/observers.

`PointerPreviewDirectory.tsx` owns the interaction; `layout.ts` is the pure
container-local clamp; `types.ts` is the content schema. CSS selectors are
prefixed `recipe-preview`. The preview has bounded width/height and may crop long
copy visually; full descriptions always remain semantic DOM. This is an
enhancement, so do not place essential instructions only in the image preview.

See [PointerPreviewDemo.tsx](../../recipe-demos/PointerPreviewDemo.tsx) and
[pointerPreview.test.tsx](../../../test/recipes/pointerPreview.test.tsx).
