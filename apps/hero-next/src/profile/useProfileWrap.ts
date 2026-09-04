import { useLayoutEffect, useRef, type RefObject } from "react";
import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";

import {
  groupHeroProfileLineIndexes,
  resolveHeroProfileLineShiftForExclusions,
  type HeroProfileHorizontalBounds,
  type HeroProfileWrapExclusion,
  type HeroProfileWrapRect,
  type HeroProfileWrapSide,
} from "./wrap";

type HeroProfileWrapRefs = {
  readonly flowRef: RefObject<HTMLDivElement | null>;
  readonly modelExclusionRef: RefObject<HTMLDivElement | null>;
  readonly speechBubbleExclusionRef: RefObject<HTMLDivElement | null>;
};

type HeroProfileLineMeasurement = HeroProfileWrapRect & {
  readonly tokens: readonly HTMLElement[];
};

const lineShiftProperty = "--hero-profile-line-shift";
const wrapTextSelector = "[data-profile-wrap-text]";
const wrapTokenSelector = "[data-profile-wrap-token]";
const lineGapProperty = "--hero-profile-line-gap";
const edgeInsetProperty = "--hero-profile-edge-inset";

export function useHeroProfileWrap(progressKey: string): HeroProfileWrapRefs {
  const store = useScrollEffectProgressStore();
  const flowRef = useRef<HTMLDivElement | null>(null);
  const modelExclusionRef = useRef<HTMLDivElement | null>(null);
  const speechBubbleExclusionRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const flow = flowRef.current;
    const modelExclusion = modelExclusionRef.current;
    const speechBubbleExclusion = speechBubbleExclusionRef.current;
    if (!flow || !modelExclusion || !speechBubbleExclusion) {
      return;
    }

    let wrapTexts = collectWrapTexts(flow);
    let animationFrame = 0;
    let progress = store.source.get(progressKey);
    let disposed = false;
    const touchedTokens = new Set<HTMLElement>();

    const update = () => {
      animationFrame = 0;
      const speechBubbleRadius =
        Number.parseFloat(
          window.getComputedStyle(speechBubbleExclusion).borderTopLeftRadius,
        ) || 0;
      const exclusions = [
        {
          kind: "ellipse",
          rect: toWrapRect(modelExclusion.getBoundingClientRect()),
        },
        {
          kind: "rounded-rectangle",
          rect: toWrapRect(speechBubbleExclusion.getBoundingClientRect()),
          radius: speechBubbleRadius,
        },
      ] satisfies readonly HeroProfileWrapExclusion[];
      const profileRect = toWrapRect(
        (flow.closest(".hero-profile") ?? flow).getBoundingClientRect(),
      );
      const styles = window.getComputedStyle(flow);
      const edgeInset = readPixelProperty(styles, edgeInsetProperty);
      const lineGap = readPixelProperty(styles, lineGapProperty);
      const bounds = {
        left: profileRect.left + edgeInset,
        right: profileRect.right - edgeInset,
      } satisfies HeroProfileHorizontalBounds;
      const updates: { readonly token: HTMLElement; readonly shift: number }[] =
        [];

      for (const wrapText of wrapTexts) {
        const side = readWrapSide(wrapText);
        if (!side) {
          continue;
        }

        for (const line of measureLines(wrapText)) {
          const shift = resolveHeroProfileLineShiftForExclusions(
            line,
            exclusions,
            bounds,
            side,
            lineGap,
          );
          for (const token of line.tokens) {
            touchedTokens.add(token);
            updates.push({ token, shift });
          }
        }
      }

      for (const { token, shift } of updates) {
        token.style.setProperty(lineShiftProperty, `${shift.toFixed(2)}px`);
      }
    };
    const scheduleUpdate = () => {
      if (!disposed && animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(update);
      }
    };
    const unsubscribe =
      store.source.subscribe?.(() => {
        const nextProgress = store.source.get(progressKey);
        const profileRect = (
          flow.closest(".hero-profile") ?? flow
        ).getBoundingClientRect();
        const profileInViewport =
          profileRect.bottom >= 0 && profileRect.top <= window.innerHeight;
        if (nextProgress !== progress || profileInViewport) {
          progress = nextProgress;
          scheduleUpdate();
        }
      }) ?? (() => undefined);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleUpdate);
    const observeLayout = () => {
      resizeObserver?.disconnect();
      resizeObserver?.observe(flow);
      resizeObserver?.observe(modelExclusion);
      resizeObserver?.observe(speechBubbleExclusion);
      for (const wrapText of wrapTexts) {
        resizeObserver?.observe(wrapText.parentElement ?? wrapText);
      }
    };
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            wrapTexts = collectWrapTexts(flow);
            observeLayout();
            scheduleUpdate();
          });

    observeLayout();
    mutationObserver?.observe(flow, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    void document.fonts?.ready.then(scheduleUpdate);
    update();

    return () => {
      disposed = true;
      unsubscribe();
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
      for (const token of touchedTokens) {
        token.style.removeProperty(lineShiftProperty);
      }
    };
  }, [progressKey, store.source]);

  return { flowRef, modelExclusionRef, speechBubbleExclusionRef };
}

function toWrapRect(rect: DOMRect): HeroProfileWrapRect {
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function collectWrapTexts(flow: HTMLElement): readonly HTMLElement[] {
  return Array.from(flow.querySelectorAll<HTMLElement>(wrapTextSelector));
}

function readWrapSide(element: HTMLElement): HeroProfileWrapSide | null {
  const side = element.dataset.profileWrapSide;
  return side === "left" || side === "right" ? side : null;
}

function measureLines(
  wrapText: HTMLElement,
): readonly HeroProfileLineMeasurement[] {
  const tokens = Array.from(
    wrapText.querySelectorAll<HTMLElement>(wrapTokenSelector),
  )
    .map((token) => {
      const rect = token.getBoundingClientRect();
      const currentShift =
        Number.parseFloat(token.style.getPropertyValue(lineShiftProperty)) || 0;
      return {
        token,
        left: rect.left - currentShift,
        right: rect.right - currentShift,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter(({ left, right, top, bottom }) =>
      [left, right, top, bottom].every(Number.isFinite),
    )
    .sort((a, b) => a.top - b.top || a.left - b.left);

  return groupHeroProfileLineIndexes(tokens).map((indexes) => {
    const lineTokens = indexes.map((index) => tokens[index]);
    const left = Math.min(...lineTokens.map((token) => token.left));
    const right = Math.max(...lineTokens.map((token) => token.right));
    const top = Math.min(...lineTokens.map((token) => token.top));
    const bottom = Math.max(...lineTokens.map((token) => token.bottom));
    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      tokens: lineTokens.map((token) => token.token),
    };
  });
}

function readPixelProperty(
  styles: CSSStyleDeclaration,
  property: string,
): number {
  const value = Number.parseFloat(styles.getPropertyValue(property));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
