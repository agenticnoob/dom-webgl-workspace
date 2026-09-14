import { createScrollEffectProgressStore } from "@viselora/scroll-adapters";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createModelStoryController } from "../../src/recipes/model-story/controller";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function createFixture() {
  const root = document.createElement("section");
  root.innerHTML = `<div data-flow><p data-story-wrap-text data-story-wrap-side="left"><span data-story-wrap-token>Read</span><span data-story-wrap-token>this</span><span data-story-wrap-token>line</span></p></div><div data-model></div><div data-bubble>${["front", "side", "back"].map((facing) => `<span data-story-message="${facing}"><span data-story-character>A</span><span data-story-character>B</span><span data-story-character>C</span><span data-story-character>D</span></span>`).join("")}</div>`;
  document.body.append(root);
  function get(selector: string) {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing fixture ${selector}`);
    return element;
  }
  const flow = get("[data-flow]");
  const modelBox = get("[data-model]");
  const bubble = get("[data-bubble]");
  flow.style.setProperty("--model-story-edge-inset", "24px");
  flow.style.setProperty("--model-story-line-gap", "16px");
  bubble.style.borderTopLeftRadius = "18px";
  let top = 0;
  let width = 1280;
  let reduced = false;
  vi.spyOn(root, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, top, width, window.innerHeight + 2000),
  );
  vi.spyOn(modelBox, "getBoundingClientRect").mockReturnValue(
    new DOMRect(480, 100, 320, 400),
  );
  vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue(
    new DOMRect(480, 20, 320, 120),
  );
  const tokens = Array.from(
    flow.querySelectorAll<HTMLElement>("[data-story-wrap-token]"),
  );
  for (const [index, token] of tokens.entries()) {
    vi.spyOn(token, "getBoundingClientRect").mockImplementation(() => {
      const shift =
        Number.parseFloat(
          token.style.getPropertyValue("--model-story-line-shift"),
        ) || 0;
      return new DOMRect(
        250 + (index === 1 ? 100 : 0) + shift,
        index === 2 ? 600 : 280,
        index === 1 ? 270 : 100,
        30,
      );
    });
  }
  const motionChanged = new Set<EventListenerOrEventListenerObject>();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    get matches() {
      return reduced;
    },
    media: query,
    onchange: null,
    addEventListener(
      _type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) {
      if (listener) motionChanged.add(listener);
    },
    removeEventListener(
      _type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) {
      if (listener) motionChanged.delete(listener);
    },
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return true;
    },
  }));
  const request = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
  const cancel = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation(() => {});
  const store = createScrollEffectProgressStore();
  store.set("other-story", 0.7);
  const clear = vi.spyOn(store, "clear");
  const visual = { aspect: 1, reducedMotion: false, setModelReady() {} };
  const controller = createModelStoryController({
    root,
    flow,
    modelBox,
    bubble,
    progressKey: "test.story",
    store,
    visual,
  });
  return {
    root,
    bubble,
    tokens,
    visual,
    request,
    cancel,
    clear,
    motionChanged,
    controller,
    store,
    move(progress: number) {
      top = -progress * 2000;
      controller.update();
    },
    reduce() {
      reduced = true;
      controller.update();
    },
    narrow() {
      width = 700;
      controller.update();
    },
  };
}

describe("model story DOM controller", () => {
  test("publishes one native signal and deterministically restores captions when reversing", () => {
    const fixture = createFixture();
    fixture.move(0.5);
    expect(fixture.store.source.get("test.story")).toBe(0.5);
    expect(fixture.bubble.dataset.storyFacing).toBe("back");
    fixture.move(0.1875);
    const partial = Array.from(
      fixture.bubble.querySelectorAll<HTMLElement>(
        "[data-story-message='side'] [data-story-character]",
      ),
    ).map((character) => character.style.opacity);
    fixture.move(0.3125);
    expect(
      Array.from(
        fixture.bubble.querySelectorAll<HTMLElement>(
          "[data-story-message='side'] [data-story-character]",
        ),
      ).map((character) => character.style.opacity),
    ).toEqual(partial);
    fixture.move(0);
    expect(fixture.bubble.dataset.storyFacing).toBe("front");
    expect(fixture.visual.aspect).toBe(0.8);
    fixture.controller.dispose();
  });

  test("measures lines without accumulating prior transforms and removes narrow-layout shifts", () => {
    const fixture = createFixture();
    expect(
      fixture.tokens[0].style.getPropertyValue("--model-story-line-shift"),
    ).toBe("-156.00px");
    expect(
      fixture.tokens[1].style.getPropertyValue("--model-story-line-shift"),
    ).toBe("-156.00px");
    expect(
      fixture.tokens[2].style.getPropertyValue("--model-story-line-shift"),
    ).toBe("0.00px");
    fixture.controller.update();
    expect(
      fixture.tokens[0].style.getPropertyValue("--model-story-line-shift"),
    ).toBe("-156.00px");
    fixture.narrow();
    expect(
      fixture.tokens[0].style.getPropertyValue("--model-story-line-shift"),
    ).toBe("0.00px");
    fixture.controller.dispose();
  });

  test("honors reduced motion and completely releases listeners, frames, mutations, and its signal", () => {
    const fixture = createFixture();
    fixture.move(0.5);
    fixture.reduce();
    expect(fixture.visual.reducedMotion).toBe(true);
    expect(fixture.bubble.dataset.storyFacing).toBe("front");
    expect(fixture.bubble.dataset.storyPhase).toBe("holding");
    window.dispatchEvent(new Event("scroll"));
    expect(fixture.request).toHaveBeenCalledTimes(1);
    fixture.controller.dispose();
    fixture.controller.dispose();
    expect(fixture.cancel).toHaveBeenCalledWith(42);
    expect(fixture.clear).toHaveBeenCalledExactlyOnceWith("test.story");
    expect(fixture.store.source.get("other-story")).toBe(0.7);
    expect(
      fixture.tokens[0].style.getPropertyValue("--model-story-line-shift"),
    ).toBe("");
    expect(fixture.bubble.dataset.storyFacing).toBeUndefined();
    expect(fixture.motionChanged.size).toBe(0);
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    fixture.controller.update();
    expect(fixture.request).toHaveBeenCalledTimes(1);
    expect(fixture.store.source.get("test.story")).toBe(0);
  });
});
