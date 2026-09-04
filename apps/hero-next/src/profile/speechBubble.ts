import type { HeroLocale } from "../preferences/locale";

export type HeroProfileFacing = "front" | "side" | "back";

export type HeroProfileSpeechBubbleCopy = Readonly<
  Record<HeroProfileFacing, string>
>;

export type HeroProfileSpeechBubbleFrame = {
  readonly facing: HeroProfileFacing;
  readonly phase: "typing" | "holding" | "deleting" | "blank";
  readonly characterProgress: Readonly<Record<HeroProfileFacing, number>>;
};

const stageFacings = [
  "front",
  "side",
  "back",
  "side",
  "front",
] as const satisfies readonly HeroProfileFacing[];
const transitionCount = stageFacings.length - 1;
const holdStart = 0.68;

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
  const stageProgress = safeProgress * transitionCount;
  const stageIndex = Math.min(transitionCount, Math.round(stageProgress));
  const facing = stageFacings[stageIndex];
  const signedDistanceFromStage = stageProgress - stageIndex;
  const stageProximity = clampProgress(
    1 - Math.abs(signedDistanceFromStage) * 2,
  );
  const activeCharacterProgress = roundFrameValue(
    clampProgress(stageProximity / holdStart),
  );
  const characterProgress = {
    front: facing === "front" ? activeCharacterProgress : 0,
    side: facing === "side" ? activeCharacterProgress : 0,
    back: facing === "back" ? activeCharacterProgress : 0,
  } satisfies HeroProfileSpeechBubbleFrame["characterProgress"];

  return {
    facing,
    phase:
      activeCharacterProgress <= 0
        ? "blank"
        : activeCharacterProgress >= 1
          ? "holding"
          : signedDistanceFromStage < 0
            ? "typing"
            : "deleting",
    characterProgress,
  };
}

export function resolveHeroProfileVisibleCharacterCount(
  characterCount: number,
  progress: number,
): number {
  const safeCharacterCount = Math.max(0, Math.floor(characterCount));
  return Math.min(
    safeCharacterCount,
    Math.floor(safeCharacterCount * clampProgress(progress) + 1e-9),
  );
}

function roundFrameValue(value: number): number {
  return Number(value.toFixed(6));
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
