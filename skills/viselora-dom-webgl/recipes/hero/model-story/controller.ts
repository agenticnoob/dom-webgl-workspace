import type { ScrollEffectProgressStore } from "@viselora/scroll-adapters";

import type { ModelStoryVisualState } from "./effect";
import {
  resolveModelStoryFrame,
  resolveStoryCharacterCount,
  resolveStoryScrollProgress,
  type ModelStoryFacing,
} from "./frame";
import {
  groupStoryLineIndexes,
  resolveStoryLineShiftForExclusions,
  type StoryWrapExclusion,
  type StoryWrapRect,
} from "./wrap";

const lineShiftProperty = "--model-story-line-shift";
const facings = ["front", "side", "back"] as const;

type StoryControllerOptions = {
  readonly root: HTMLElement;
  readonly flow: HTMLElement;
  readonly modelBox: HTMLElement;
  readonly bubble: HTMLElement;
  readonly progressKey: string;
  readonly store: ScrollEffectProgressStore;
  readonly visual: ModelStoryVisualState;
};

type MeasuredToken = StoryWrapRect & { readonly token: HTMLElement };

/** DOM owns measurements and text. The scene effect reads only a small visual descriptor. */
export function createModelStoryController(options: StoryControllerOptions) {
  const { root, flow, modelBox, bubble, progressKey, store, visual } = options;
  const ownerWindow = root.ownerDocument.defaultView;
  if (!ownerWindow) throw new Error("ModelStory needs a mounted document.");
  const motionPreference = ownerWindow.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const touchedTokens = new Set<HTMLElement>();
  const messages = new Map<ModelStoryFacing, readonly HTMLElement[]>();
  for (const facing of facings) {
    messages.set(
      facing,
      Array.from(
        bubble.querySelectorAll<HTMLElement>(
          `[data-story-message="${facing}"] [data-story-character]`,
        ),
      ),
    );
  }
  let disposed = false;
  let frameRequest = 0;

  function update() {
    frameRequest = 0;
    if (disposed || !ownerWindow) return;
    const rootRect = root.getBoundingClientRect();
    const modelRect = modelBox.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    visual.aspect =
      modelRect.height > 0
        ? Math.max(0.1, modelRect.width / modelRect.height)
        : 1;
    visual.reducedMotion = motionPreference.matches;
    const progress = resolveStoryScrollProgress(
      rootRect.top,
      rootRect.height,
      ownerWindow.innerHeight,
    );
    store.set(progressKey, progress);
    const frame = resolveModelStoryFrame(
      store.source.get(progressKey),
      motionPreference.matches,
    );
    bubble.dataset.storyFacing = frame.facing;
    bubble.dataset.storyPhase = frame.phase;

    for (const facing of facings) {
      const characters = messages.get(facing) ?? [];
      const visible = resolveStoryCharacterCount(
        characters.length,
        facing === frame.facing ? frame.characterProgress : 0,
      );
      for (const [index, character] of characters.entries()) {
        const opacity = index < visible ? "1" : "0";
        if (character.style.opacity !== opacity)
          character.style.opacity = opacity;
      }
    }

    const bubbleStyles = ownerWindow.getComputedStyle(bubble);
    const exclusions =
      rootRect.width <= 760
        ? []
        : ([
            { kind: "ellipse", rect: toStoryRect(modelRect) },
            {
              kind: "rounded-rectangle",
              rect: toStoryRect(bubbleRect),
              radius: Number.parseFloat(bubbleStyles.borderTopLeftRadius) || 0,
            },
          ] satisfies readonly StoryWrapExclusion[]);
    const flowStyles = ownerWindow.getComputedStyle(flow);
    const edgeInset = readPixelProperty(flowStyles, "--model-story-edge-inset");
    const gap = readPixelProperty(flowStyles, "--model-story-line-gap");
    const bounds = {
      left: rootRect.left + edgeInset,
      right: rootRect.right - edgeInset,
    };
    const updates: { readonly token: HTMLElement; readonly shift: number }[] =
      [];

    // Read every line before writing transforms; one token's shift cannot affect a later read.
    for (const text of flow.querySelectorAll<HTMLElement>(
      "[data-story-wrap-text]",
    )) {
      const side = text.dataset.storyWrapSide;
      if (side !== "left" && side !== "right") continue;
      const tokens = measureTokens(text);
      for (const indexes of groupStoryLineIndexes(tokens)) {
        const line = indexes.map((index) => tokens[index]);
        const left = Math.min(...line.map((item) => item.left));
        const right = Math.max(...line.map((item) => item.right));
        const top = Math.min(...line.map((item) => item.top));
        const bottom = Math.max(...line.map((item) => item.bottom));
        const shift = resolveStoryLineShiftForExclusions(
          {
            left,
            right,
            top,
            bottom,
            width: right - left,
            height: bottom - top,
          },
          exclusions,
          bounds,
          side,
          gap,
        );
        for (const { token } of line) updates.push({ token, shift });
      }
    }
    for (const { token, shift } of updates) {
      touchedTokens.add(token);
      token.style.setProperty(lineShiftProperty, `${shift.toFixed(2)}px`);
    }
  }

  function schedule() {
    if (!disposed && frameRequest === 0 && ownerWindow)
      frameRequest = ownerWindow.requestAnimationFrame(update);
  }

  const resizeObserver =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  resizeObserver?.observe(root);
  resizeObserver?.observe(flow);
  resizeObserver?.observe(modelBox);
  resizeObserver?.observe(bubble);
  const mutationObserver = new MutationObserver(schedule);
  mutationObserver.observe(flow, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  ownerWindow.addEventListener("scroll", schedule, { passive: true });
  ownerWindow.addEventListener("resize", schedule, { passive: true });
  motionPreference.addEventListener("change", schedule);
  root.ownerDocument.fonts?.addEventListener("loadingdone", schedule);
  void root.ownerDocument.fonts?.ready.then(schedule);
  update();

  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      ownerWindow.removeEventListener("scroll", schedule);
      ownerWindow.removeEventListener("resize", schedule);
      motionPreference.removeEventListener("change", schedule);
      root.ownerDocument.fonts?.removeEventListener("loadingdone", schedule);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      if (frameRequest !== 0) ownerWindow.cancelAnimationFrame(frameRequest);
      for (const token of touchedTokens)
        token.style.removeProperty(lineShiftProperty);
      for (const characters of messages.values()) {
        for (const character of characters)
          character.style.removeProperty("opacity");
      }
      delete bubble.dataset.storyFacing;
      delete bubble.dataset.storyPhase;
      store.clear(progressKey);
    },
  };
}

function measureTokens(text: HTMLElement): readonly MeasuredToken[] {
  return Array.from(
    text.querySelectorAll<HTMLElement>("[data-story-wrap-token]"),
  ).map((token) => {
    const rect = token.getBoundingClientRect();
    const shift =
      Number.parseFloat(token.style.getPropertyValue(lineShiftProperty)) || 0;
    return {
      token,
      ...toStoryRect(rect),
      left: rect.left - shift,
      right: rect.right - shift,
    };
  });
}

function toStoryRect(rect: DOMRect): StoryWrapRect {
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function readPixelProperty(
  styles: CSSStyleDeclaration,
  property: string,
): number {
  const value = Number.parseFloat(styles.getPropertyValue(property));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
