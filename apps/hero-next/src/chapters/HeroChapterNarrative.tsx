import React from "react";

import {
  getHeroChapterContent,
  heroPublicLinks,
  heroSiteContent,
} from "./content";
import {
  getHeroChapterDefinition,
  heroChapterCount,
  heroChapterOrder,
} from "./definitions";
import { HeroChapter } from "./HeroChapter";
import { HeroLocaleControl } from "./HeroLocaleControl";
import { useHeroChapterFrameStyle } from "./useChapterFrameStyle";
import type { HeroLocale } from "../preferences/locale";

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
      <HeroLocaleControl locale={locale} onLocaleChange={onLocaleChange} />

      <section className="hero-hub-runway" aria-label={site.intro.eyebrow}>
        <p className="hero-sr-only">
          {site.intro.title} {site.intro.summary} {site.intro.hint}
        </p>
      </section>

      {heroChapterOrder.map((chapterId) => {
        const content = getHeroChapterContent(chapterId, locale);
        const definition = getHeroChapterDefinition(chapterId);

        return (
          <React.Fragment key={chapterId}>
            <HeroChapter
              definition={definition}
              content={content}
              frameStyle={frameStyle}
              continueLabel={site.continueLabel}
            />

            {definition.ordinal < heroChapterCount ? (
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
            <a
              href={heroPublicLinks.githubProfile}
              target="_blank"
              rel="noreferrer"
            >
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
