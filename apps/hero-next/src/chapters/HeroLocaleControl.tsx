import React from "react";

import { heroSiteContent } from "./content";
import { heroLocales, type HeroLocale } from "../preferences/locale";

type HeroLocaleControlProps = {
  readonly locale: HeroLocale;
  readonly onLocaleChange: (locale: HeroLocale) => void;
};

export function HeroLocaleControl({
  locale,
  onLocaleChange,
}: HeroLocaleControlProps) {
  return (
    <div
      className="hero-locale"
      role="group"
      aria-label={heroSiteContent[locale].localeControlLabel}
    >
      {heroLocales.map((option) => (
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
