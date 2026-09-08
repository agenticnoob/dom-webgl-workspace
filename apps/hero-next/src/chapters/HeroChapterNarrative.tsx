import React, { useEffect } from "react";

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
import type { HeroLocale } from "../preferences/locale";
import { HeroProfileChapterBody } from "../profile/HeroProfileChapterBody";
import { HeroAxiomsChapterBody } from "../axioms/HeroAxiomsReader";
import { getAxiomsContent } from "../axioms/content";
import { HeroProjectsChapterBody } from "../projects/HeroProjectRoom";
import { HeroSignalsChapterBody } from "../signals/HeroSignalsChapterBody";
import type { ProjectRoomStore } from "../projects/room";

export function HeroChapterNarrative({
  locale,
  onLocaleChange,
  onLayoutChange,
  projectRoom,
}: {
  readonly locale: HeroLocale;
  readonly onLocaleChange: (locale: HeroLocale) => void;
  readonly onLayoutChange: () => void;
  readonly projectRoom: ProjectRoomStore;
}) {
  const site = heroSiteContent[locale];

  useEffect(() => {
    let animationFrame = 0;
    const scheduleRefresh = () => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(() => {
          animationFrame = 0;
          onLayoutChange();
        });
      }
    };

    onLayoutChange();
    window.addEventListener("resize", scheduleRefresh, { passive: true });
    return () => {
      window.removeEventListener("resize", scheduleRefresh);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [locale, onLayoutChange]);

  return (
    <>
      <HeroLocaleControl locale={locale} onLocaleChange={onLocaleChange} />

      <section
        className="hero-hub-runway hero-hub-runway--opening"
        aria-label={site.intro.eyebrow}
      >
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
              {...(chapterId === "self"
                ? { className: "hero-chapter--profile" }
                : chapterId === "axioms"
                  ? { className: "hero-chapter--axioms" }
                  : chapterId === "builds"
                    ? { className: "hero-chapter--projects" }
                    : {})}
            >
              {chapterId === "self" ? (
                <HeroProfileChapterBody
                  definition={definition}
                  content={content}
                  locale={locale}
                />
              ) : chapterId === "axioms" ? (
                <HeroAxiomsChapterBody
                  definition={definition}
                  content={getAxiomsContent(locale)}
                />
              ) : chapterId === "builds" ? (
                <HeroProjectsChapterBody
                  definition={definition}
                  content={content}
                  locale={locale}
                  room={projectRoom}
                  onLayoutChange={onLayoutChange}
                />
              ) : (
                <HeroSignalsChapterBody
                  key={locale}
                  definition={definition}
                  content={content}
                  locale={locale}
                />
              )}
            </HeroChapter>

            {definition.ordinal < heroChapterCount ? (
              <section className="hero-hub-runway" aria-hidden="true">
                <p className="hero-sr-only">{site.intermediateHub}</p>
              </section>
            ) : null}
          </React.Fragment>
        );
      })}

      <section
        className="hero-hub-runway hero-hub-runway--final"
        aria-labelledby="hero-final-title"
      >
        <div className="hero-sr-only">
          <p>{site.final.eyebrow}</p>
          <h2 id="hero-final-title">{site.final.title}</h2>
          <p>{site.final.summary}</p>
        </div>
        <nav className="hero-final-links" aria-label={site.final.linksLabel}>
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
      </section>
    </>
  );
}
