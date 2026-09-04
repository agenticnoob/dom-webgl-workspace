import {
  getHeroChapterDefinition,
  heroChapterOrder,
  type HeroChapterId,
} from "./definitions";
import { heroTransitionConfig } from "../transition/transitionConfig";

export type HeroChapterScrollPhase =
  | "hub-start"
  | "intro-handoff"
  | "orient-approach"
  | "face-approach"
  | "triangle-reveal"
  | "dom-content"
  | "triangle-contract"
  | "face-retreat"
  | "orient-retreat"
  | "hub-end";

export type HeroChapterScrollState = {
  readonly chapterId: HeroChapterId;
  readonly phase: HeroChapterScrollPhase;
  readonly phaseProgress: number;
  readonly entryProgress: number;
  readonly exitProgress: number;
  readonly introHandoff: number;
  readonly orientation: number;
  readonly approach: number;
  readonly screenLock: number;
  readonly triangleReveal: number;
  readonly domContentActive: boolean;
  readonly hubInteractive: boolean;
};

export type HeroChapterScrollSignalReader = {
  get(key: string): number;
};

export function resolveHeroChapterScrollState(
  entryProgress: number,
  exitProgress: number,
  chapterId: HeroChapterId = heroChapterOrder[0],
): HeroChapterScrollState {
  const entry = normalized(entryProgress);
  const exit = normalized(exitProgress);
  const { entry: entryStops, exit: exitStops } =
    heroTransitionConfig.chapterScroll;
  const isFirstChapter = chapterId === heroChapterOrder[0];
  const flightStart = isFirstChapter ? entryStops.introHandoffEnd : 0;
  const flight = snapToStops(segment(entry, flightStart, 1), [
    entryStops.orientEnd,
    entryStops.lockEnd,
  ]);
  const entryApproach = eased(segment(flight, 0, entryStops.lockEnd));
  const entryOrientation = eased(flight);
  const exitFlight =
    entryStops.lockEnd * (1 - segment(exit, exitStops.contractEnd, 1));
  const exitOrientation = eased(exitFlight);
  const exitApproach = eased(segment(exitFlight, 0, entryStops.lockEnd));

  if (exit >= 1) {
    return createState(
      chapterId,
      "hub-end",
      1,
      entry,
      exit,
      0,
      0,
      0,
      0,
      false,
      true,
    );
  }

  if (exit > 0) {
    if (exit < exitStops.contractEnd) {
      const progress = segment(exit, 0, exitStops.contractEnd);
      const reveal = 1 - eased(progress);
      const curtainFlight =
        entryStops.lockEnd + (1 - entryStops.lockEnd) * (1 - progress);
      return createState(
        chapterId,
        "triangle-contract",
        progress,
        entry,
        exit,
        eased(curtainFlight),
        1,
        reveal,
        reveal,
      );
    }
    if (exit < exitStops.retreatEnd) {
      const progress = segment(
        exit,
        exitStops.contractEnd,
        exitStops.retreatEnd,
      );
      return createState(
        chapterId,
        "face-retreat",
        progress,
        entry,
        exit,
        exitOrientation,
        exitApproach,
        0,
        0,
      );
    }

    const progress = segment(exit, exitStops.retreatEnd, 1);
    return createState(
      chapterId,
      "orient-retreat",
      progress,
      entry,
      exit,
      exitOrientation,
      exitApproach,
      0,
      0,
    );
  }

  if (entry <= 0) {
    return createState(
      chapterId,
      "hub-start",
      0,
      entry,
      exit,
      0,
      0,
      0,
      0,
      false,
      true,
    );
  }
  if (isFirstChapter && entry < entryStops.introHandoffEnd) {
    const progress = segment(entry, 0, entryStops.introHandoffEnd);
    return createState(
      chapterId,
      "intro-handoff",
      progress,
      entry,
      exit,
      0,
      0,
      0,
      0,
      false,
      true,
    );
  }
  if (flight < entryStops.orientEnd) {
    const progress = segment(flight, 0, entryStops.orientEnd);
    return createState(
      chapterId,
      "orient-approach",
      progress,
      entry,
      exit,
      entryOrientation,
      entryApproach,
      0,
      0,
    );
  }
  if (flight < entryStops.lockEnd) {
    const progress = segment(flight, entryStops.orientEnd, entryStops.lockEnd);
    return createState(
      chapterId,
      "face-approach",
      progress,
      entry,
      exit,
      entryOrientation,
      entryApproach,
      0,
      0,
    );
  }
  if (flight < 1) {
    const progress = segment(flight, entryStops.lockEnd, 1);
    const reveal = eased(progress);
    return createState(
      chapterId,
      "triangle-reveal",
      progress,
      entry,
      exit,
      entryOrientation,
      1,
      reveal,
      reveal,
    );
  }

  return createState(
    chapterId,
    "dom-content",
    1,
    entry,
    exit,
    1,
    1,
    1,
    1,
    true,
    false,
  );
}

export function readHeroChapterScrollState(
  reader: HeroChapterScrollSignalReader,
): HeroChapterScrollState {
  let state = resolveHeroChapterScrollState(0, 0);

  for (const chapterId of heroChapterOrder) {
    const { signals } = getHeroChapterDefinition(chapterId);
    const entry = reader.get(signals.entry);
    const exit = reader.get(signals.exit);

    if (entry > 0 || exit > 0) {
      state = resolveHeroChapterScrollState(entry, exit, chapterId);
    }
  }

  return state;
}

export function readHeroChapterTailAtlasIds(
  reader: HeroChapterScrollSignalReader,
): readonly HeroChapterId[] {
  return heroChapterOrder.filter((chapterId) => {
    const { signals } = getHeroChapterDefinition(chapterId);
    return reader.get(signals.exit) > 0;
  });
}

function createState(
  chapterId: HeroChapterId,
  phase: HeroChapterScrollPhase,
  phaseProgress: number,
  entryProgress: number,
  exitProgress: number,
  orientation: number,
  approach: number,
  screenLock: number,
  triangleReveal: number,
  domContentActive = false,
  hubInteractive = false,
): HeroChapterScrollState {
  return {
    chapterId,
    phase,
    phaseProgress: normalized(phaseProgress),
    entryProgress,
    exitProgress,
    introHandoff: resolveIntroHandoff(chapterId, entryProgress),
    orientation: normalized(orientation),
    approach: normalized(approach),
    screenLock: normalized(screenLock),
    triangleReveal: normalized(triangleReveal),
    domContentActive,
    hubInteractive,
  };
}

function resolveIntroHandoff(
  chapterId: HeroChapterId,
  entryProgress: number,
): number {
  if (chapterId !== heroChapterOrder[0]) {
    return 1;
  }

  return eased(
    segment(
      entryProgress,
      0,
      heroTransitionConfig.chapterScroll.entry.introHandoffEnd,
    ),
  );
}

function segment(value: number, start: number, end: number): number {
  return normalized((value - start) / Math.max(1e-9, end - start));
}

function snapToStops(value: number, stops: readonly number[]): number {
  for (const stop of stops) {
    if (Math.abs(value - stop) <= 1e-9) {
      return stop;
    }
  }

  return value;
}

function eased(value: number): number {
  const safeValue = normalized(value);
  return safeValue * safeValue * (3 - 2 * safeValue);
}

function normalized(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
