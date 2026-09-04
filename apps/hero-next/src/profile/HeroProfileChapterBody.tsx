import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import React from "react";

import {
  formatHeroChapterCounter,
  type HeroChapterDefinition,
} from "../chapters/definitions";
import type { HeroChapterLocalizedContent } from "../chapters/content";
import type { HeroLocale } from "../preferences/locale";
import { HeroProfileSpeechBubble } from "./HeroProfileSpeechBubble";
import { HeroProfileWrappedText } from "./HeroProfileWrappedText";
import type { HeroProfileWrapSide } from "./wrap";
import { useHeroProfileWrap } from "./useProfileWrap";

type HeroProfileChapterBodyProps = {
  readonly definition: HeroChapterDefinition;
  readonly content: HeroChapterLocalizedContent;
  readonly locale: HeroLocale;
};

export function HeroProfileChapterBody({
  definition,
  content,
  locale,
}: HeroProfileChapterBodyProps) {
  const chapterId = `chapter-${definition.ordinal}`;
  const chapterCounter = formatHeroChapterCounter(definition);
  const { flowRef, modelExclusionRef, speechBubbleExclusionRef } =
    useHeroProfileWrap(definition.signals.body);
  const leftSections = content.body.sections.filter(
    (_, index) => index % 2 === 0,
  );
  const rightSections = content.body.sections.filter(
    (_, index) => index % 2 === 1,
  );

  return (
    <WebGLScrollTimeline
      as="section"
      id={`${chapterId}-body-timeline`}
      progressKey={definition.signals.body}
      className="hero-chapter__body hero-profile"
      start="top top"
      end="bottom bottom"
      scrub
      aria-labelledby={`${chapterId}-body`}
    >
      <div ref={flowRef} className="hero-profile__flow">
        <HeroProfileSpeechBubble
          locale={locale}
          progressKey={definition.signals.body}
          exclusionRef={speechBubbleExclusionRef}
        />
        <header className="hero-profile__lead">
          <p className="hero-profile__index">
            <HeroProfileWrappedText side="left" text={chapterCounter} />
          </p>
          <h2 id={`${chapterId}-body`}>
            <HeroProfileWrappedText side="left" text={content.body.title} />
          </h2>
          <p>
            <HeroProfileWrappedText side="right" text={content.body.intro} />
          </p>
        </header>

        <div className="hero-profile__story">
          <div
            className="hero-profile__story-column"
            data-profile-column="left"
          >
            {leftSections.map((section) => (
              <section key={section.title} className="hero-profile__story-item">
                <HeroProfileRule side="left" />
                <p>
                  <HeroProfileWrappedText side="left" text={section.label} />
                </p>
                <h3>
                  <HeroProfileWrappedText side="left" text={section.title} />
                </h3>
                <p>
                  <HeroProfileWrappedText side="left" text={section.body} />
                </p>
              </section>
            ))}
          </div>
          <div
            className="hero-profile__story-column"
            data-profile-column="right"
          >
            {rightSections.map((section) => (
              <section key={section.title} className="hero-profile__story-item">
                <HeroProfileRule side="right" />
                <p>
                  <HeroProfileWrappedText side="right" text={section.label} />
                </p>
                <h3>
                  <HeroProfileWrappedText side="right" text={section.title} />
                </h3>
                <p>
                  <HeroProfileWrappedText side="right" text={section.body} />
                </p>
              </section>
            ))}
          </div>
        </div>

        {content.body.closing ? (
          <div className="hero-profile__outro">
            <blockquote className="hero-profile__closing">
              <HeroProfileWrappedText side="left" text={content.body.closing} />
            </blockquote>
          </div>
        ) : null}

        <div
          ref={modelExclusionRef}
          className="hero-profile__model-exclusion"
          data-profile-model-exclusion=""
          aria-hidden="true"
        />
      </div>
    </WebGLScrollTimeline>
  );
}

function HeroProfileRule({ side }: { readonly side: HeroProfileWrapSide }) {
  return (
    <span
      className="hero-profile__story-rule"
      data-profile-wrap-text=""
      data-profile-wrap-side={side}
      aria-hidden="true"
    >
      <span
        className="hero-profile__wrap-token hero-profile__story-rule-line"
        data-profile-wrap-token=""
      />
    </span>
  );
}
