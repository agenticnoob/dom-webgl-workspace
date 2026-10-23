import type { Vector3Tuple } from "three";

import type { GalleryItem } from "./GalleryReveal";
import type { Hotspot } from "./ProductTurntable";

/** Page progress signal: 0 at the top, 1 at the bottom of the page. */
export const showcaseProgressKey = "showcase";

/**
 * Block heights in viewport heights; chapters below follow from them. The
 * scrollable distance is the total minus one viewport.
 */
export const showcaseBlocks = {
  intro: 120,
  form: 260,
  gallery: 220,
  product: 300,
  outro: 100,
} as const;

export const showcaseChapters = [
  "intro",
  "form",
  "gallery",
  "product",
  "outro",
] as const;
type ShowcaseChapter = (typeof showcaseChapters)[number];

type ProgressRange = {
  readonly key: string;
  readonly from: number;
  readonly to: number;
};

/** Chapter positions in page progress, measured from the DOM blocks. */
export type ShowcaseLayout = {
  /** Where each chapter starts, in `showcaseChapters` order. */
  readonly starts: readonly number[];
  readonly form: ProgressRange;
  readonly product: ProgressRange;
  /** Chapter hand-overs that get a transition veil. */
  readonly boundaries: readonly number[];
};

/** Before measurement: the block heights alone. */
export const initialShowcaseLayout = layoutFromStarts(
  [0, 120, 380, 600, 900].map((offset) => offset / 900),
  0.95,
);

function layoutFromStarts(
  starts: readonly number[],
  productEnd: number,
): ShowcaseLayout {
  return {
    starts,
    form: { key: showcaseProgressKey, from: 0, to: starts[2] },
    product: { key: showcaseProgressKey, from: starts[3], to: productEnd },
    boundaries: [starts[2], starts[3]],
  };
}

/**
 * Chapters change when a block's top reaches the middle of the viewport.
 * `tops` are document offsets of the blocks in chapter order.
 */
export function measureShowcaseLayout(
  tops: Readonly<Record<ShowcaseChapter, number>>,
  productBottom: number,
  scrollHeight: number,
  viewportHeight: number,
): ShowcaseLayout {
  const scrollable = Math.max(1, scrollHeight - viewportHeight);
  const at = (offset: number) => Math.min(1, Math.max(0, offset / scrollable));
  const starts = showcaseChapters.map((chapter, index) =>
    index === 0 ? 0 : at(tops[chapter] - viewportHeight / 2),
  );
  return layoutFromStarts(starts, at(productBottom - viewportHeight));
}

export function showcaseChapterAt(layout: ShowcaseLayout, progress: number) {
  let chapter = 0;
  layout.starts.forEach((start, index) => {
    if (progress >= start) chapter = index;
  });
  return chapter;
}

// One camera point per eighth of the page (the rail is parametric).
export const showcasePath: readonly Vector3Tuple[] = [
  [0, 0, 9],
  [0.8, 0.3, 8],
  [-0.9, 0.2, 7.4],
  [0, 0, 6.4],
  [0, 0.2, -8],
  [0, 0.3, -24],
  [0, 0.6, -32.5],
  [3.4, 1.1, -35],
  [0, 1.8, -34],
];

export const showcaseLook: readonly Vector3Tuple[] = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, -30],
  [0, 0, -40],
  [0, 0, -40],
  [0, 0, -40],
  [0, 0, -40],
];

export const productPosition: Vector3Tuple = [0, 0, -40];

export const showcaseColors = {
  background: "#0b0c10",
  ink: "#ece8e1",
  accent: "#f2a541",
  particles: "#9fb7ff",
} as const;

const frame = (number: number) =>
  `/example/bg-sequence/frame_${String(number).padStart(4, "0")}.webp`;

export const galleryTargetId = "showcase-gallery";

// Each card reveals a contrasting image on hover.
export const galleryItems: readonly GalleryItem[] = [
  { id: "gallery-1", src: frame(1), reveal: "/example/image.png", alt: "林间小路的晨光", caption: "晨光 / 01" },
  { id: "gallery-2", src: "/example/show.png", reveal: "/example/bg.png", alt: "树根与溪流", caption: "溪流 / 02" },
  { id: "gallery-3", src: frame(121), reveal: "/example/mask.png", alt: "穿过树冠的光束", caption: "光束 / 03" },
  { id: "gallery-4", src: "/example/bg.png", reveal: frame(361), alt: "蓝白色的流动纹理", caption: "纹理 / 04" },
  { id: "gallery-5", src: frame(181), reveal: "/example/bg.png", alt: "森林深处", caption: "深处 / 05" },
  { id: "gallery-6", src: "/example/mask.png", reveal: "/example/image.png", alt: "苔藓与树根", caption: "苔藓 / 06" },
  { id: "gallery-7", src: frame(301), reveal: "/example/show.png", alt: "林间的薄雾", caption: "薄雾 / 07" },
  { id: "gallery-8", src: "/example/image.png", reveal: frame(61), alt: "一头大象", caption: "远行 / 08" },
];

export const productHotspots: readonly Hotspot[] = [
  { id: "apex", point: [0, 0.36, 0] },
  { id: "facet", point: [0.3, -0.18, 0.26] },
  { id: "base", point: [-0.32, -0.3, -0.2] },
];

export const wordTargetId = "showcase-word";
