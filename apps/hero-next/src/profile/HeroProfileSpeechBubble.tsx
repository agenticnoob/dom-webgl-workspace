import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";
import React, { useLayoutEffect, useRef, type RefObject } from "react";

import type { HeroLocale } from "../preferences/locale";
import {
  getHeroProfileSpeechBubbleCopy,
  resolveHeroProfileSpeechBubbleFrame,
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

    const messages = new Map(
      Array.from(
        root.querySelectorAll<HTMLElement>("[data-profile-speech-message]"),
      ).map((element) => [element.dataset.profileSpeechMessage, element]),
    );
    const motionPreference = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    let animationFrame = 0;
    let disposed = false;

    const update = () => {
      animationFrame = 0;
      const frame = resolveHeroProfileSpeechBubbleFrame(
        store.source.get(progressKey),
        motionPreference?.matches ?? false,
      );
      root.dataset.profileFacing = frame.facing;
      root.setAttribute("aria-label", copy[frame.facing]);
      for (const facing of facings) {
        const message = messages.get(facing);
        if (message) {
          message.style.opacity = frame.weights[facing].toFixed(4);
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
      role="note"
      aria-label={copy.front}
    >
      <div
        ref={(element) => {
          exclusionRef.current = element;
        }}
        className="hero-profile__speech-balloon"
      >
        {facings.map((facing) => (
          <span
            key={facing}
            className="hero-profile__speech-message"
            data-profile-speech-message={facing}
            style={{ opacity: facing === "front" ? 1 : 0 }}
            aria-hidden="true"
          >
            {copy[facing]}
          </span>
        ))}
      </div>
      <span className="hero-profile__speech-tail" aria-hidden="true">
        <span className="hero-profile__speech-tail-fill" />
      </span>
    </div>
  );
}
