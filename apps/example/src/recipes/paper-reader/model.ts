import type { CSSProperties } from "react";

export type PaperReaderViewport = {
  readonly width: number;
  readonly height: number;
};

export type PaperReaderPaperSize = {
  /** Fraction of the available paper area, greater than zero and at most one. */
  readonly width: number;
  readonly height: number;
};

export type PaperReaderPaperOptions = { readonly paper?: PaperReaderPaperSize };

export type PaperReaderArticle = PaperReaderPaperOptions & {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  /** Plain text. Full text remains available in the semantic transcript. */
  readonly body: string;
};

export type PaperReaderPalette = {
  /** Opaque six-digit sRGB hex color, for example #172124. */
  readonly background: string;
  readonly foreground: string;
};

export type PaperReaderContent = {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly PaperReaderArticle[];
};

export type PaperReaderProps = {
  /** Unique across every recipe mounted in the same runtime. Remount to change. */
  readonly id: string;
  readonly articles: readonly PaperReaderArticle[];
  readonly title?: string;
  readonly description?: string;
  readonly eyebrow?: string;
  readonly palette?: PaperReaderPalette;
  readonly className?: string;
  /** CSS height of the visual stage; use a stage at least 480px tall. */
  readonly height?: CSSProperties["height"];
  /** Sticky offset, in CSS pixels. */
  readonly stickyTop?: number;
  readonly transcriptLabel?: string;
  readonly onError?: (error: Error) => void;
};

export const defaultPaperReaderPalette = {
  background: "#172124",
  foreground: "#f3f0e7",
} satisfies PaperReaderPalette;

export function validatePaperReader(props: PaperReaderProps): void {
  if (!props.id.trim()) throw new Error("PaperReader requires a non-empty id.");
  const ids = new Set<string>();
  for (const article of props.articles) {
    if (!article.id.trim() || ids.has(article.id)) {
      throw new Error("PaperReader article ids must be non-empty and unique.");
    }
    ids.add(article.id);
    const size = article.paper;
    if (
      size &&
      !(
        size.width > 0 &&
        size.width <= 1 &&
        size.height > 0 &&
        size.height <= 1
      )
    ) {
      throw new Error(
        "PaperReader paper dimensions must be fractions greater than zero and at most one.",
      );
    }
  }
  const palette = props.palette ?? defaultPaperReaderPalette;
  for (const color of [palette.background, palette.foreground]) {
    if (!/^#[\da-f]{6}$/i.test(color)) {
      throw new Error(
        "PaperReader palette colors must use six-digit hex notation.",
      );
    }
  }
  if (
    props.stickyTop !== undefined &&
    (!Number.isFinite(props.stickyTop) || props.stickyTop < 0)
  ) {
    throw new Error(
      "PaperReader stickyTop must be a non-negative finite number.",
    );
  }
}
