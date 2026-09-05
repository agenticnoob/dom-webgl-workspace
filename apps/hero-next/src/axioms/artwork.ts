import type { HeroViewport } from "../shared/viewport";
import type { AxiomsReaderContent } from "./model";
import { axiomsReaderConfig } from "./config";
import { resolveAxiomsLayout, type AxiomsLayout } from "./layout";
import {
  appendText,
  type AxiomsTile,
  type TextMeasurer,
  type TextLine,
} from "./typography";

export type AxiomsArtwork = {
  readonly layout: AxiomsLayout;
  readonly header: AxiomsTile;
  readonly fans: readonly AxiomsTile[];
  readonly papers: readonly AxiomsTile[];
};

export function createAxiomsArtwork(
  context: TextMeasurer,
  viewport: HeroViewport,
  content: AxiomsReaderContent,
  headingLabel: string,
): AxiomsArtwork {
  let layout = resolveAxiomsLayout(viewport, content.sections);
  const headerLines: TextLine[] = [];
  appendText(
    context,
    headerLines,
    headingLabel,
    0,
    0,
    layout.header.width,
    layout.labelSize,
    400,
  );
  const titleSize =
    layout.viewport.width <= axiomsReaderConfig.compactBreakpoint
      ? 22
      : Math.min(38, layout.viewport.width * 0.027);
  const titleBottom = appendText(
    context,
    headerLines,
    content.title,
    0,
    26,
    layout.header.width *
      (layout.viewport.width <= axiomsReaderConfig.compactBreakpoint
        ? 0.76
        : 0.88),
    titleSize,
    400,
  );
  const headerBottom = appendText(
    context,
    headerLines,
    content.intro,
    0,
    titleBottom + 12,
    layout.header.width * 0.9,
    layout.viewport.width <= axiomsReaderConfig.compactBreakpoint ? 11 : 14,
    400,
    1.45,
  );
  layout = resolveAxiomsLayout(
    layout.viewport,
    content.sections,
    layout.header.y + headerBottom + 24,
  );
  const header = { ...layout.header, lines: headerLines };
  const fans = content.sections.map((section, i) => {
    const lines: TextLine[] = [];
    const inset =
      layout.viewport.width <= axiomsReaderConfig.compactBreakpoint ? 10 : 14;
    appendText(
      context,
      lines,
      String(i + 1).padStart(2, "0"),
      inset,
      12,
      layout.fan.width - inset * 2,
      layout.labelSize,
      400,
    );
    const bottom = appendText(
      context,
      lines,
      section.title,
      inset,
      32,
      layout.fan.width - inset * 2,
      layout.fanSize,
      700,
    );
    return {
      width: layout.fan.width,
      height: Math.max(layout.fan.height, bottom + 12),
      lines,
    };
  });
  const fanHeight = Math.max(
    layout.fan.height,
    ...fans.map((fan) => fan.height),
  );
  layout = { ...layout, fan: { ...layout.fan, height: fanHeight } };
  const papers = content.sections.map((section, i) => {
    const lines: TextLine[] = [];
    const width = layout.papers[i].width;
    const pad = layout.padding;
    const inner = width - 2 * pad;
    let y = appendText(
      context,
      lines,
      section.label,
      pad,
      pad,
      inner,
      layout.labelSize,
      400,
    );
    y = appendText(
      context,
      lines,
      section.title,
      pad,
      y + pad,
      inner,
      layout.titleSize,
      700,
    );
    y = appendText(
      context,
      lines,
      section.body,
      pad,
      y + pad,
      inner,
      layout.bodySize,
      400,
      1.65,
    );
    return {
      width,
      height: Math.max(layout.papers[i].height, y + pad * 1.5),
      lines,
    };
  });
  return {
    layout: {
      ...layout,
      paperOverflow: papers.map((paper, i) =>
        Math.max(0, paper.height - layout.papers[i].height),
      ),
    },
    header,
    fans: fans.map((fan) => ({ ...fan, height: fanHeight })),
    papers,
  };
}
