import React from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { defaultSpatialPalette } from "./config";
import { panelLayout } from "./atlas";
import { SpatialScene } from "./SpatialScene";
import { useSpatialStage } from "./stage";
import type { SpatialEffectParams } from "./effects";
import type {
  FourFaces,
  PortalChapter,
  PortalPanelContent,
  ReliefModel,
  SpatialMotion,
  SpatialPalette,
} from "./types";
import "./spatial.css";

const defaultMotion: SpatialMotion = {};
export type FacePortalProps = {
  readonly id: string;
  readonly chapters: FourFaces<PortalChapter>;
  readonly palette?: SpatialPalette;
  readonly model?: ReliefModel;
  /** Scroll runway lengths in viewport heights. */
  readonly entryScreens?: number;
  readonly exitScreens?: number;
};

export function FacePortal({
  id,
  chapters,
  palette = defaultSpatialPalette,
  model,
  entryScreens = 2.6,
  exitScreens = 2,
}: FacePortalProps) {
  if (!id.trim()) throw new Error("FacePortal requires a nonempty, unique id.");
  if (
    chapters.length !== 4 ||
    new Set(chapters.map((chapter) => chapter.id)).size !== 4
  )
    throw new Error(
      "FacePortal requires exactly four chapters with unique ids.",
    );
  if (
    ![entryScreens, exitScreens, model?.size ?? 1, model?.bodyScale ?? 1].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new RangeError(
      "FacePortal durations and model dimensions must be positive.",
    );
  const { root, viewport, stage, ready, size } = useSpatialStage(id, true);
  const [reading, setReading] = useState(false);
  const previousReading = useRef(reading);
  useLayoutEffect(() => {
    if (previousReading.current === reading) return;
    previousReading.current = reading;
    // The mode changes runway heights; start from a predictable document position.
    root.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [reading, root]);
  const params = useMemo(
    () =>
      ({
        stage,
        palette,
        motion: defaultMotion,
        chapters,
        relief: model,
      }) satisfies SpatialEffectParams,
    [stage, palette, chapters, model],
  );
  const enhanced = ready && !reading;
  return (
    <section
      ref={root}
      className="spatial-portal"
      data-ready={enhanced}
      style={{
        background: enhanced ? "transparent" : palette.background,
        color: palette.foreground,
      }}
      aria-label="四面空间叙事"
    >
      <div className="spatial-portal-stage" aria-hidden={reading}>
        <div ref={viewport} className="spatial-viewport">
          <SpatialScene id={id} params={params} />
        </div>
      </div>
      <div className="spatial-reader-toggle">
        <button
          type="button"
          aria-pressed={reading}
          style={{ background: palette.background, color: palette.foreground }}
          onClick={() => setReading((value) => !value)}
        >
          {reading ? "返回空间演示" : "显示完整正文"}
        </button>
      </div>
      <div className="spatial-cycles">
        {chapters.map((chapter, index) => (
          <div key={chapter.id} data-spatial-cycle data-active="false">
            <div
              data-spatial-entry
              className="spatial-runway"
              style={{ height: `${entryScreens * 100}svh` }}
              aria-hidden="true"
            />
            <article
              id={`${id}-${chapter.id}`}
              data-spatial-body
              className="spatial-body"
              style={{ color: palette.background }}
            >
              <PortalPanel
                content={chapter.entry}
                width={size.width}
                height={size.height}
                relief={Boolean(model) && index === (model?.face ?? 0)}
              />
              {Boolean(chapter.paragraphs?.length || chapter.link) && (
                <div className="spatial-prose">
                  {chapter.paragraphs?.map((paragraph, paragraphIndex) => (
                    <p key={`${chapter.id}.${paragraphIndex}`}>{paragraph}</p>
                  ))}
                  {chapter.link && (
                    <a className="spatial-link" href={chapter.link.href}>
                      {chapter.link.label} ↗
                    </a>
                  )}
                </div>
              )}
              {Boolean(
                chapter.exit || chapter.paragraphs?.length || chapter.link,
              ) && (
                <PortalPanel
                  content={chapter.exit ?? chapter.entry}
                  width={size.width}
                  height={size.height}
                  relief={Boolean(model) && index === (model?.face ?? 0)}
                />
              )}
            </article>
            <div
              data-spatial-exit
              className="spatial-runway"
              style={{ height: `${exitScreens * 100}svh` }}
              aria-hidden="true"
            />
            <div className="spatial-hub-gap" aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}

function PortalPanel({
  content,
  width,
  height,
  relief,
}: {
  readonly content: PortalPanelContent;
  readonly width: number;
  readonly height: number;
  readonly relief: boolean;
}) {
  const layout = panelLayout({ width, height }, relief);
  return (
    <header className="spatial-panel" style={{ height }}>
      <div
        style={{
          left: layout.title.x,
          top: layout.title.y,
          width: layout.title.width,
        }}
      >
        <span style={{ fontSize: layout.labelSize }}>{content.label}</span>
        <h2 style={{ fontSize: layout.titleSize }}>{content.title}</h2>
      </div>
      <p
        style={{
          left: layout.description.x,
          top: layout.description.y,
          width: layout.description.width,
          fontSize: layout.descriptionSize,
        }}
      >
        {content.description}
      </p>
    </header>
  );
}
