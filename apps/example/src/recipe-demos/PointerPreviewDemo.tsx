import React from "react";
import {
  PointerPreviewDirectory,
  type PointerPreviewItem,
} from "../recipes/pointer-preview";

const items = [
  {
    id: "images",
    title: "Image studies",
    detail: "Texture / Composition",
    label: "Visual reference",
    description:
      "A small collection of surfaces and compositions. Images remain visible in the list on narrow and touch screens.",
    href: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img",
    image: {
      src: "/example/image.png",
      alt: "Example image composition",
      width: 1920,
      height: 1920,
    },
  },
  {
    id: "motion",
    title: "Motion notes",
    detail: "Timing / Rhythm",
    label: "Interaction reference",
    description:
      "Move along the row and its preview follows continuously inside this directory. Keyboard focus opens a stationary preview.",
    href: "https://developer.mozilla.org/en-US/docs/Web/CSS/transition",
  },
  {
    id: "landscape",
    title: "Open landscapes",
    detail: "Space / Light",
    label: "Image reference",
    description:
      "The preview stays within the component boundary. Each row is a real link with complete semantic content.",
    href: "https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit",
    image: {
      src: "/example/bg.png",
      alt: "Example landscape",
      width: 1672,
      height: 941,
    },
  },
  {
    id: "reading",
    title: "Reading room",
    detail: "Type / Language",
    label: "Reading reference",
    description:
      "Reduced motion keeps previews still. Escape dismisses the preview, while all links remain available.",
    href: "https://developer.mozilla.org/en-US/docs/Web/Accessibility",
  },
] satisfies readonly PointerPreviewItem[];

export default function PointerPreviewDemo() {
  return (
    <PointerPreviewDirectory
      items={items}
      title="Elsewhere, in detail"
      intro="Move to preview. Focus with Tab. Follow any row to explore."
      footer="A DOM companion: no WebGL runtime required."
    />
  );
}
