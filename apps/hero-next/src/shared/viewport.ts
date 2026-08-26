export type HeroViewport = {
  readonly width: number;
  readonly height: number;
};

export const heroDefaultViewport = {
  width: 1_440,
  height: 900,
} as const satisfies HeroViewport;

export function readHeroViewport(): HeroViewport {
  if (typeof window === "undefined") {
    return heroDefaultViewport;
  }

  return {
    width: positive(window.innerWidth, heroDefaultViewport.width),
    height: positive(window.innerHeight, heroDefaultViewport.height),
  };
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
