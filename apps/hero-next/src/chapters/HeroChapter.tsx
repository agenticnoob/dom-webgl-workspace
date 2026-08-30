import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import React from "react";

import type { HeroChapterLocalizedContent } from "./content";
import { heroChapterCount, type HeroChapterDefinition } from "./definitions";
import type { HeroChapterFrameStyle } from "./useChapterFrameStyle";

type HeroChapterProps = {
  readonly definition: HeroChapterDefinition;
  readonly content: HeroChapterLocalizedContent;
  readonly frameStyle: HeroChapterFrameStyle;
  readonly continueLabel: string;
};

type HeroChapterFrameProps = {
  readonly className: string;
  readonly style: HeroChapterFrameStyle;
  readonly content: HeroChapterLocalizedContent;
};

export function HeroChapter({
  definition,
  content,
  frameStyle,
  continueLabel,
}: HeroChapterProps) {
  const chapterId = `chapter-${definition.ordinal}`;
  const exitId = `${chapterId}-exit`;
  const chapterCounter = `${definition.number} / ${String(heroChapterCount).padStart(2, "0")}`;

  return (
    <div className="hero-chapter-cycle">
      <WebGLScrollTimeline
        as="section"
        id={`hero.chapter-${definition.ordinal}.entry.timeline`}
        progressKey={definition.signals.entry}
        className="hero-entry-runway"
        start="top top"
        end="bottom top"
        scrub
        aria-hidden="true"
      />

      <article
        id={chapterId}
        className="hero-chapter"
        aria-label={`${chapterCounter} · ${content.body.eyebrow}`}
      >
        <HeroChapterFrame
          className="hero-chapter__entry-frame"
          style={frameStyle}
          content={content}
        />

        <section
          className="hero-chapter__body"
          aria-labelledby={`${chapterId}-body`}
        >
          <p className="hero-chapter__index">{chapterCounter}</p>
          <h2 id={`${chapterId}-body`}>{content.body.title}</h2>
          <p>{content.body.intro}</p>

          <div className="hero-chapter__notes">
            {content.body.sections.map((section, index) => (
              <section key={section.title} className="hero-chapter__note">
                <p>
                  {String(index + 1).padStart(2, "0")} / {section.label}
                </p>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
                {section.link ? (
                  <a href={section.link.href} target="_blank" rel="noreferrer">
                    {section.link.label} ↗
                  </a>
                ) : null}
              </section>
            ))}
          </div>

          {content.body.closing ? (
            <blockquote className="hero-chapter__closing">
              {content.body.closing}
            </blockquote>
          ) : null}

          <a className="hero-chapter__link" href={`#${exitId}`}>
            {continueLabel}
          </a>
        </section>

        <WebGLScrollTimeline
          as="section"
          id={`hero.chapter-${definition.ordinal}.exit.timeline`}
          progressKey={definition.signals.exit}
          className="hero-exit-runway"
          start="top top"
          end="bottom bottom"
          scrub
          aria-hidden="true"
        >
          <div id={exitId} className="hero-exit-sticky">
            <HeroChapterFrame
              className="hero-chapter__exit-frame"
              style={frameStyle}
              content={content}
            />
          </div>
        </WebGLScrollTimeline>
      </article>
    </div>
  );
}

function HeroChapterFrame({
  className,
  style,
  content,
}: HeroChapterFrameProps) {
  return (
    <section className={`hero-chapter__frame ${className}`} style={style}>
      <header className="hero-chapter__header">
        <p>{content.frame.eyebrow}</p>
        <h1>
          {content.frame.titleLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p>{content.frame.summary}</p>
      </header>
      <div className="hero-chapter__frame-cards">
        {content.frame.signals.map((signal) => (
          <div key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
