import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import React from "react";

import { heroChapterOneContent } from "./heroChapterContent";
import {
  useHeroChapterFrameStyle,
  type HeroChapterFrameStyle,
} from "./heroChapterLayoutReact";
import { heroTransitionConfig } from "./heroTransitionConfig";

export function HeroChapterNarrative() {
  const frameStyle = useHeroChapterFrameStyle();

  return (
    <>
      <section className="hero-hub-runway" aria-label="Chapter hub">
        <p className="hero-sr-only">
          Hold the tetrahedron to switch theme, or scroll to enter chapter one.
        </p>
      </section>

      <WebGLScrollTimeline
        as="section"
        id="hero.chapter-1.entry.timeline"
        progressKey={heroTransitionConfig.signalKeys.chapterEntry}
        className="hero-entry-runway"
        start="top top"
        end="bottom top"
        scrub
        aria-hidden="true"
      />

      <article
        id="chapter-1"
        className="hero-chapter"
        aria-label="Chapter 1 prototype"
      >
        <HeroChapterFrame
          className="hero-chapter__entry-frame"
          style={frameStyle}
        />

        <section className="hero-chapter__body" aria-labelledby="chapter-1-body">
          <p className="hero-chapter__index">01 / 04</p>
          <h2 id="chapter-1-body">A real DOM chapter</h2>
          <p>
            This semantic layer owns reading, selection, focus, and interaction.
            The WebGL surface is only its reversible decorative projection.
          </p>
          <div className="hero-chapter__notes">
            {heroChapterOneContent.cards.map(([number, label]) => (
              <section key={number} className="hero-chapter__note">
                <p>{number}</p>
                <h3>{label}</h3>
                <p>One scroll coordinate, reconstructed in either direction.</p>
              </section>
            ))}
          </div>
          <a className="hero-chapter__link" href="#chapter-1-exit">
            Continue to the chapter exit
          </a>
        </section>

        <WebGLScrollTimeline
          as="section"
          id="hero.chapter-1.exit.timeline"
          progressKey={heroTransitionConfig.signalKeys.chapterExit}
          className="hero-exit-runway"
          start="top top"
          end="bottom bottom"
          scrub
        >
          <div id="chapter-1-exit" className="hero-exit-sticky">
            <HeroChapterFrame
              className="hero-chapter__exit-frame"
              style={frameStyle}
            />
          </div>
        </WebGLScrollTimeline>
      </article>

      <section
        className="hero-hub-runway hero-hub-runway--final"
        aria-label="Chapter hub"
      >
        <p className="hero-sr-only">
          Chapter one complete. Hold the tetrahedron to switch theme.
        </p>
      </section>
    </>
  );
}

function HeroChapterFrame({
  className,
  style,
}: {
  readonly className: string;
  readonly style: HeroChapterFrameStyle;
}) {
  const titleLines = heroChapterOneContent.title.split(/\s+/);

  return (
    <section className={`hero-chapter__frame ${className}`} style={style}>
      <header className="hero-chapter__header">
        <p>{heroChapterOneContent.eyebrow}</p>
        <h1>
          {titleLines.map((line, index) => (
            <React.Fragment key={line}>
              {index > 0 ? " " : null}
              <span>{line}</span>
            </React.Fragment>
          ))}
        </h1>
        <p>{heroChapterOneContent.summary}</p>
      </header>
      <div className="hero-chapter__frame-cards" aria-hidden="true">
        {heroChapterOneContent.cards.map(([number, label]) => (
          <div key={number}>
            <span>{number}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
