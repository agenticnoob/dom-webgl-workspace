import { heroChapterOrder, type HeroChapterId } from "../chapters/definitions";
import {
  readHeroChapterScrollState,
  type HeroChapterScrollSignalReader,
  type HeroChapterScrollState,
} from "../chapters/scrollState";
import { heroTransitionConfig } from "./transitionConfig";

export const heroPortalTerminalContentId = "contact" as const;

export type HeroPortalContentId =
  "site" | HeroChapterId | typeof heroPortalTerminalContentId;
export type HeroPortalNarrativeContentId = Exclude<HeroPortalContentId, "site">;
export type HeroPortalRenderKey =
  "site" | "site+content" | "none" | HeroPortalNarrativeContentId;
export type HeroPortalSide = "left" | "right";

export type HeroPortalViewState = {
  readonly activeContentId?: HeroPortalNarrativeContentId;
  readonly sitePresence: number;
  readonly contentPresence: number;
};

export type HeroPortalMotion = {
  readonly visible: boolean;
  readonly opacity: number;
  readonly horizontalOffsetProgress: number;
  readonly rotationY: number;
};

export function readHeroPortalViewState(
  reader: HeroChapterScrollSignalReader,
): HeroPortalViewState {
  return resolveHeroPortalViewState(readHeroChapterScrollState(reader));
}

export function resolveHeroPortalViewState(
  chapter: HeroChapterScrollState,
): HeroPortalViewState {
  const nextContentId =
    chapter.exitProgress > 0
      ? resolveContentAfterChapter(chapter.chapterId)
      : chapter.chapterId;
  const activeContentId = nextContentId;
  const sitePresence = 1 - chapter.introHandoff;
  const contentPresence = activeContentId ? 1 - sitePresence : 0;

  return { activeContentId, sitePresence, contentPresence };
}

export function resolveHeroPortalRenderKey(
  reader: HeroChapterScrollSignalReader,
): HeroPortalRenderKey {
  const state = readHeroPortalViewState(reader);

  if (state.sitePresence > 0 && state.contentPresence <= 0) {
    return "site";
  }
  if (state.sitePresence > 0) {
    return "site+content";
  }
  return state.activeContentId ?? "none";
}

export function resolveHeroPortalMotion(
  state: HeroPortalViewState,
  target: {
    readonly contentId: HeroPortalContentId;
    readonly side: HeroPortalSide;
  },
): HeroPortalMotion {
  const isSite = target.contentId === "site";
  const isActiveContent = target.contentId === state.activeContentId;
  const opacity = isSite
    ? state.sitePresence
    : isActiveContent
      ? state.contentPresence
      : 0;
  const handoffTravel = isSite
    ? 1 - state.sitePresence
    : isActiveContent && state.sitePresence > 0
      ? 1 - state.contentPresence
      : 0;
  const sideDirection = target.side === "left" ? -1 : 1;
  const travelDirection = isSite ? sideDirection : -sideDirection;
  const rotationY =
    handoffTravel === 0
      ? 0
      : travelDirection *
        handoffTravel *
        heroTransitionConfig.portal.handoffYaw;

  return {
    visible: opacity > 0.001,
    opacity,
    horizontalOffsetProgress:
      handoffTravel === 0 ? 0 : travelDirection * handoffTravel,
    rotationY,
  };
}

function resolveContentAfterChapter(
  chapterId: HeroChapterId,
): HeroPortalNarrativeContentId {
  const currentIndex = heroChapterOrder.indexOf(chapterId);

  return heroChapterOrder[currentIndex + 1] ?? heroPortalTerminalContentId;
}
