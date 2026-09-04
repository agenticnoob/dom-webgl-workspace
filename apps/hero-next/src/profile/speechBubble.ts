import type { HeroLocale } from "../preferences/locale";

export type HeroProfileFacing = "front" | "side" | "back";

export type HeroProfileSpeechBubbleCopy = Readonly<
  Record<HeroProfileFacing, string>
>;

export type HeroProfileSpeechBubbleFrame = {
  readonly facing: HeroProfileFacing;
  readonly weights: Readonly<Record<HeroProfileFacing, number>>;
};

const fullTurn = Math.PI * 2;
const zeroThreshold = 1e-12;

const speechBubbleCopy = {
  zh: {
    front: "这是我的正面",
    side: "这是我的侧面",
    back: "这是我的背面",
  },
  en: {
    front: "This is my front.",
    side: "This is my side.",
    back: "This is my back.",
  },
} as const satisfies Readonly<Record<HeroLocale, HeroProfileSpeechBubbleCopy>>;

export function getHeroProfileSpeechBubbleCopy(
  locale: HeroLocale,
): HeroProfileSpeechBubbleCopy {
  return speechBubbleCopy[locale];
}

export function resolveHeroProfileSpeechBubbleFrame(
  progress: number,
  reducedMotion: boolean,
): HeroProfileSpeechBubbleFrame {
  const safeProgress = reducedMotion ? 0 : clampProgress(progress);
  const angle = safeProgress * fullTurn;
  const cosine = snapZero(Math.cos(angle));
  const sine = snapZero(Math.sin(angle));
  const front = squarePositive(cosine);
  const side = sine * sine;
  const back = squarePositive(-cosine);
  const total = front + side + back;
  const weights = {
    front: front / total,
    side: side / total,
    back: back / total,
  } satisfies HeroProfileSpeechBubbleFrame["weights"];

  return {
    facing:
      weights.side > Math.max(weights.front, weights.back)
        ? "side"
        : weights.back > weights.front
          ? "back"
          : "front",
    weights,
  };
}

function squarePositive(value: number): number {
  const positive = Math.max(0, value);
  return positive * positive;
}

function snapZero(value: number): number {
  return Math.abs(value) <= zeroThreshold ? 0 : value;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
