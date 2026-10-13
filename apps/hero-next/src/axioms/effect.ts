import type { AxiomsArtwork } from "./artwork";
import type { HeroLocale } from "../preferences/locale";
import type { HeroViewport } from "../shared/viewport";
import { createHeroAxiomsArtwork } from "./reader";

export function createAxiomsReaderArtwork(
  viewport: HeroViewport,
  locale: HeroLocale,
): AxiomsArtwork {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Axioms reader requires text measurement.");
  return createHeroAxiomsArtwork(context, viewport, locale);
}
