import {
  formatHeroChapterCounter,
  heroChapterDefinitions,
} from "../chapters/definitions";
import type { HeroLocale } from "../preferences/locale";
import type { HeroViewport } from "../shared/viewport";
import { createAxiomsArtwork } from "./artwork";
import { getAxiomsContent } from "./content";
import type { TextMeasurer } from "./typography";

// App adapter: both the live reader and tetrahedron endpoints use this composition.
export function createHeroAxiomsArtwork(
  context: TextMeasurer,
  viewport: HeroViewport,
  locale: HeroLocale,
) {
  const content = getAxiomsContent(locale).body;
  return createAxiomsArtwork(
    context,
    viewport,
    content,
    formatAxiomsHeading(content.eyebrow),
  );
}

export function formatAxiomsHeading(eyebrow: string): string {
  return `${formatHeroChapterCounter(heroChapterDefinitions.axioms)} · ${eyebrow}`;
}
