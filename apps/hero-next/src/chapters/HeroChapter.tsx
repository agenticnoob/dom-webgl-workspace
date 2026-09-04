import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import React, { type ReactNode } from "react";

import type { HeroChapterLocalizedContent } from "./content";
import {
  formatHeroChapterCounter,
  type HeroChapterDefinition,
} from "./definitions";

type HeroChapterProps = {
  readonly definition: HeroChapterDefinition;
  readonly content: HeroChapterLocalizedContent;
  readonly className?: string;
  readonly children: ReactNode;
};

export type HeroChapterBodyProps = {
  readonly definition: HeroChapterDefinition;
  readonly content: HeroChapterLocalizedContent;
};

export function HeroChapter({
  definition,
  content,
  className,
  children,
}: HeroChapterProps) {
  const chapterId = `chapter-${definition.ordinal}`;
  const chapterCounter = formatHeroChapterCounter(definition);

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
        className={["hero-chapter", className].filter(Boolean).join(" ")}
        aria-label={`${chapterCounter} · ${content.body.eyebrow}`}
      >
        <WebGLScrollTimeline
          as="div"
          id={`hero.chapter-${definition.ordinal}.content.timeline`}
          progressKey={definition.signals.content}
          className="hero-chapter__content-cycle"
          start="top top"
          end="bottom top"
          scrub
        >
          {children}
        </WebGLScrollTimeline>

        <WebGLScrollTimeline
          as="section"
          id={`hero.chapter-${definition.ordinal}.exit.timeline`}
          progressKey={definition.signals.exit}
          className="hero-exit-runway"
          start="top bottom"
          end="bottom bottom"
          scrub
          aria-hidden="true"
        />
      </article>
    </div>
  );
}

export function HeroChapterBody({ definition, content }: HeroChapterBodyProps) {
  const chapterId = `chapter-${definition.ordinal}`;
  const chapterCounter = formatHeroChapterCounter(definition);

  return (
    <WebGLScrollTimeline
      as="section"
      id={`${chapterId}-body-timeline`}
      progressKey={definition.signals.body}
      className="hero-chapter__body"
      start="top top"
      end="bottom bottom"
      scrub
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
    </WebGLScrollTimeline>
  );
}
