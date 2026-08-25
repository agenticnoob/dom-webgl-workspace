import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";
import React from "react";

import {
  heroChapters,
  heroPublicLinks,
  heroSiteContent,
  type HeroChapter,
  type HeroChapterLocalizedContent,
  type HeroLocale,
} from "./heroChapterContent";
import {
  useHeroChapterFrameStyle,
  type HeroChapterFrameStyle,
} from "./heroChapterLayoutReact";
import { heroTransitionConfig } from "./heroTransitionConfig";

export function HeroChapterNarrative({
  locale,
  onLocaleChange,
}: {
  readonly locale: HeroLocale;
  readonly onLocaleChange: (locale: HeroLocale) => void;
}) {
  const frameStyle = useHeroChapterFrameStyle();
  const site = heroSiteContent[locale];

  return (
    <>
      <LocaleControl locale={locale} onLocaleChange={onLocaleChange} />

      <section className="hero-hub-runway" aria-label={site.intro.eyebrow}>
        <p className="hero-sr-only">
          {site.intro.title} {site.intro.summary} {site.intro.hint}
        </p>
      </section>

      {heroChapters.map((chapter, chapterIndex) => {
        const content = chapter.content[locale];
        const signals = heroTransitionConfig.signalKeys.chapters[chapterIndex]!;

        return (
          <React.Fragment key={chapter.id}>
            <HeroChapter
              chapter={chapter}
              content={content}
              entryProgressKey={signals.entry}
              exitProgressKey={signals.exit}
              frameStyle={frameStyle}
              continueLabel={site.continueLabel}
            />

            {chapterIndex < heroChapters.length - 1 ? (
              <section className="hero-hub-runway" aria-hidden="true">
                <p className="hero-sr-only">{site.intermediateHub}</p>
              </section>
            ) : null}
          </React.Fragment>
        );
      })}

      <section className="hero-hub-runway hero-hub-runway--final">
        <div className="hero-final-hub">
          <p>{site.final.eyebrow}</p>
          <h2>{site.final.title}</h2>
          <p>{site.final.summary}</p>
          <nav aria-label={site.final.linksLabel}>
            <a href={heroPublicLinks.githubProfile} target="_blank" rel="noreferrer">
              {site.final.github}
            </a>
            <a href={heroPublicLinks.blog} target="_blank" rel="noreferrer">
              {site.final.blog}
            </a>
          </nav>
        </div>
      </section>
    </>
  );
}

function LocaleControl({
  locale,
  onLocaleChange,
}: {
  readonly locale: HeroLocale;
  readonly onLocaleChange: (locale: HeroLocale) => void;
}) {
  const label = heroSiteContent[locale].localeControlLabel;

  return (
    <div className="hero-locale" role="group" aria-label={label}>
      {(["zh", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          data-hero-locale-option={option}
          aria-pressed={locale === option}
          onClick={() => onLocaleChange(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function HeroChapter({
  chapter,
  content,
  entryProgressKey,
  exitProgressKey,
  frameStyle,
  continueLabel,
}: {
  readonly chapter: HeroChapter;
  readonly content: HeroChapterLocalizedContent;
  readonly entryProgressKey: string;
  readonly exitProgressKey: string;
  readonly frameStyle: HeroChapterFrameStyle;
  readonly continueLabel: string;
}) {
  const chapterOrdinal = Number.parseInt(chapter.number, 10);
  const chapterId = `chapter-${chapterOrdinal}`;
  const exitId = `${chapterId}-exit`;

  return (
    <>
      <WebGLScrollTimeline
        as="section"
        id={`hero.chapter-${chapterOrdinal}.entry.timeline`}
        progressKey={entryProgressKey}
        className="hero-entry-runway"
        start="top top"
        end="bottom top"
        scrub
        aria-hidden="true"
      >
        <HeroTransitionCopy content={content} />
      </WebGLScrollTimeline>

      <article
        id={chapterId}
        className="hero-chapter"
        aria-label={`${chapter.number} / 04 · ${content.body.eyebrow}`}
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
          <p className="hero-chapter__index">{chapter.number} / 04</p>
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
          id={`hero.chapter-${chapterOrdinal}.exit.timeline`}
          progressKey={exitProgressKey}
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
    </>
  );
}

function HeroTransitionCopy({
  content,
}: {
  readonly content: HeroChapterLocalizedContent;
}) {
  return (
    <div className="hero-transition-copy">
      <section>
        <p>{content.portal.left.label}</p>
        <p>{content.portal.left.body}</p>
      </section>
      <section>
        <p>{content.portal.right.label}</p>
        <ul>
          {content.portal.right.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function HeroChapterFrame({
  className,
  style,
  content,
}: {
  readonly className: string;
  readonly style: HeroChapterFrameStyle;
  readonly content: HeroChapterLocalizedContent;
}) {
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
