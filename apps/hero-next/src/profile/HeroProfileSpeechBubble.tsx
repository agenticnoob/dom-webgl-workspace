import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";
import React, { useLayoutEffect, useRef, type RefObject } from "react";

import type { HeroLocale } from "../preferences/locale";
import { readHeroChapterScrollState } from "../chapters/scrollState";
import {
  getHeroProfileSpeechBubbleCopy,
  resolveHeroProfileSpeechBubbleFrame,
  resolveHeroProfileVisibleCharacterCount,
  type HeroProfileFacing,
} from "./speechBubble";

type HeroProfileSpeechBubbleProps = {
  readonly locale: HeroLocale;
  readonly progressKey: string;
  readonly exclusionRef: RefObject<HTMLDivElement | null>;
};

const facings = [
  "front",
  "side",
  "back",
] as const satisfies readonly HeroProfileFacing[];

export function HeroProfileSpeechBubble({
  locale,
  progressKey,
  exclusionRef,
}: HeroProfileSpeechBubbleProps) {
  const store = useScrollEffectProgressStore();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const copy = getHeroProfileSpeechBubbleCopy(locale);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const messages = new Map<
      HeroProfileFacing,
      {
        readonly element: HTMLElement;
        readonly characters: readonly HTMLElement[];
      }
    >();
    for (const facing of facings) {
      const element = root.querySelector<HTMLElement>(
        `[data-profile-speech-message="${facing}"]`,
      );
      if (element) {
        messages.set(facing, {
          element,
          characters: Array.from(
            element.querySelectorAll<HTMLElement>(
              "[data-profile-speech-character]",
            ),
          ),
        });
      }
    }
    const motionPreference = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    let animationFrame = 0;
    let disposed = false;

    const update = () => {
      animationFrame = 0;
      const chapter = readHeroChapterScrollState(store.source);
      root.style.visibility =
        chapter.chapterId === "self" && chapter.domContentActive
          ? ""
          : "hidden";
      const frame = resolveHeroProfileSpeechBubbleFrame(
        store.source.get(progressKey),
        motionPreference?.matches ?? false,
      );
      root.dataset.profileFacing = frame.facing;
      root.dataset.profileSpeechPhase = frame.phase;
      root.setAttribute("aria-label", copy[frame.facing]);
      for (const facing of facings) {
        const message = messages.get(facing);
        if (message) {
          const visibleCharacterCount = resolveHeroProfileVisibleCharacterCount(
            message.characters.length,
            frame.characterProgress[facing],
          );
          message.element.dataset.profileVisibleCharacters = String(
            visibleCharacterCount,
          );
          for (let index = 0; index < message.characters.length; index += 1) {
            const character = message.characters[index];
            const opacity = index < visibleCharacterCount ? "1" : "0";
            if (character.style.opacity !== opacity) {
              character.style.opacity = opacity;
            }
          }
        }
      }
    };
    const scheduleUpdate = () => {
      if (!disposed && animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(update);
      }
    };
    const unsubscribe =
      store.source.subscribe?.(scheduleUpdate) ?? (() => undefined);

    motionPreference?.addEventListener?.("change", scheduleUpdate);
    update();

    return () => {
      disposed = true;
      unsubscribe();
      motionPreference?.removeEventListener?.("change", scheduleUpdate);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [copy, progressKey, store.source]);

  return (
    <div
      ref={rootRef}
      className="hero-profile__speech-bubble"
      data-profile-speech-bubble=""
      data-profile-facing="front"
      data-profile-speech-phase="holding"
      role="note"
      aria-label={copy.front}
    >
      <div
        ref={(element) => {
          exclusionRef.current = element;
        }}
        className="hero-profile__speech-balloon"
      >
        <div
          className="hero-profile__speech-surface"
          data-profile-speech-surface=""
        >
          {facings.map((facing) => (
            <span
              key={facing}
              className="hero-profile__speech-message"
              data-profile-speech-message={facing}
              data-profile-visible-characters={
                facing === "front" ? Array.from(copy[facing]).length : 0
              }
              aria-hidden="true"
            >
              {Array.from(copy[facing]).map((character, index) => (
                <span
                  key={index}
                  className="hero-profile__speech-character"
                  data-profile-speech-character=""
                  style={{ opacity: facing === "front" ? 1 : 0 }}
                >
                  {character}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <span
        className="hero-profile__speech-tail"
        data-profile-speech-tail=""
        aria-hidden="true"
      >
        <span className="hero-profile__speech-tail-fill" />
      </span>
    </div>
  );
}
