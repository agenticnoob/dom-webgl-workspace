import { createScrollEffectProgressStore } from "@viselora/scroll-adapters";
import { afterEach, expect, test, vi } from "vitest";
import { createTimelineController } from "../../src/recipes/perspective-timeline/controller";
import type { TimelineStageState } from "../../src/recipes/perspective-timeline/effects";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("measures its own row deep in the shared page and clears only its own signals", () => {
  const root = document.createElement("section");
  const view = document.createElement("div");
  const store = createScrollEffectProgressStore();
  store.set("other.travel", 0.7);
  const stage: TimelineStageState = {
    visible: false,
    viewport: { width: 1, height: 1 },
  };
  let top = 20000;
  let viewTop = 20000;
  vi.spyOn(root, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, top, 1000, 4500),
  );
  vi.spyOn(view, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, viewTop, 1000, 900),
  );
  const controller = createTimelineController({
    root,
    view,
    stage,
    progressKey: "timeline.travel",
    store,
  });
  expect(stage.visible).toBe(false);
  expect(store.source.get("timeline.travel")).toBe(0);
  top = -1800;
  viewTop = 0;
  controller.update();
  expect(stage.viewport).toEqual({ width: 1000, height: 900 });
  expect(stage.visible).toBe(true);
  expect(store.source.get("timeline.travel")).toBe(0.5);
  top = -900;
  controller.update();
  expect(store.source.get("timeline.travel")).toBe(0.25);
  top = -3600;
  controller.update();
  expect(store.source.get("timeline.travel")).toBe(1);
  controller.dispose();
  controller.dispose();
  expect(stage.visible).toBe(false);
  expect(store.source.get("timeline.travel")).toBe(0);
  expect(store.source.get("timeline.travel.visible")).toBe(0);
  expect(store.source.get("other.travel")).toBe(0.7);
  top = -1800;
  controller.update();
  expect(store.source.get("timeline.travel")).toBe(0);
});

test("cancels queued measurement and removes scroll/resize observers on disposal", () => {
  const root = document.createElement("section");
  const view = document.createElement("div");
  const stage: TimelineStageState = {
    visible: false,
    viewport: { width: 1, height: 1 },
  };
  const request = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
  const cancel = vi.spyOn(window, "cancelAnimationFrame");
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function createObserver() {
      return { observe: vi.fn(), disconnect };
    }),
  );
  const controller = createTimelineController({
    root,
    view,
    stage,
    progressKey: "timeline.travel",
    store: createScrollEffectProgressStore(),
  });
  window.dispatchEvent(new Event("scroll"));
  window.dispatchEvent(new Event("resize"));
  expect(request).toHaveBeenCalledTimes(1);
  controller.dispose();
  expect(cancel).toHaveBeenCalledWith(42);
  expect(disconnect).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("scroll"));
  expect(request).toHaveBeenCalledTimes(1);
});
