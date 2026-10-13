import {
  heroTransitionConfig,
  type HeroSchemeName,
} from "../transition/transitionConfig";

export const heroProfileMaterialRoughness = 0.72;

export function resolveHeroProfileMaterialColor(
  scheme: HeroSchemeName,
): string {
  switch (scheme) {
    case "initial":
    case "inverted":
      return heroTransitionConfig.colors.light;
  }
}

export {
  resolveHeroProfileModelFrame,
  type HeroProfileModelFrame,
} from "./frame";
