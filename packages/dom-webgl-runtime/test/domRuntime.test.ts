import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createDOMTargetRegistry,
  type DOMTargetRegistry,
} from "../src/lib/domRuntime";

const registries: DOMTargetRegistry[] = [];
const viewport = { width: 800, height: 600 };

afterEach(() => {
  for (const registry of registries.splice(0)) registry.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function createRegistry(invalidate = vi.fn()) {
  const registry = createDOMTargetRegistry(invalidate);
  registries.push(registry);
  return registry;
}

function createTarget(top = 20) {
  const element = document.createElement("h2");
  element.textContent = "DOM fallback";
  document.body.append(element);
  const measure = vi
    .spyOn(element, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(10, top, 200, 40));
  return { element, measure };
}

describe("DOM runtime target management", () => {
  test("keeps semantic DOM visible by default even when the visual is ready", () => {
    const registry = createRegistry();
    const { element } = createTarget();
    registry.register("title", element);
    registry.measure(viewport);
    registry.setAvailable(true);
    registry.setReady("title", true);
    expect(element.style.opacity).toBe("");
    expect(registry.get("title")).toMatchObject({ visible: true, ready: true });
  });

  test("requires visual readiness and renderer availability before hiding fallback", () => {
    const registry = createRegistry();
    const { element } = createTarget();
    const unregister = registry.register("title", element, {
      hideWhenReady: true,
    });
    registry.measure(viewport);
    registry.setReady("title", true);
    expect(element.style.opacity).toBe("");
    registry.setAvailable(true);
    expect(element.style.opacity).toBe("0");

    element.style.color = "red";
    element.className = "new-theme";
    registry.setAvailable(false);
    expect(element.style.opacity).toBe("");
    expect(element.style.color).toBe("red");
    expect(element.className).toBe("new-theme");
    registry.setAvailable(true);
    unregister();
    unregister();
    expect(element.style.opacity).toBe("");
    expect(registry.get("title")).toBeUndefined();
  });

  test("batches layout reads before fallback writes", () => {
    const registry = createRegistry();
    const first = createTarget();
    const second = createTarget(100);
    const observedOpacity: string[] = [];
    first.measure.mockImplementation(() => {
      observedOpacity.push(first.element.style.opacity);
      return new DOMRect(10, 20, 200, 40);
    });
    second.measure.mockImplementation(() => {
      observedOpacity.push(first.element.style.opacity);
      return new DOMRect(10, 100, 200, 40);
    });
    registry.register("first", first.element, { hideWhenReady: true });
    registry.register("second", second.element, { hideWhenReady: true });
    registry.setAvailable(true);
    registry.setReady("first", true);
    registry.setReady("second", true);
    registry.measure(viewport);
    expect(observedOpacity).toEqual(["", ""]);
    expect(first.element.style.opacity).toBe("0");
    expect(second.element.style.opacity).toBe("0");
  });

  test("restores offscreen DOM and retains parked readiness through reverse scroll", () => {
    const registry = createRegistry();
    const restored = createTarget();
    const parked = createTarget();
    registry.register("restored", restored.element, { hideWhenReady: true });
    registry.register("parked", parked.element, {
      hideWhenReady: true,
      offscreen: "park",
    });
    registry.setAvailable(true);
    registry.measure(viewport);
    registry.setReady("restored", true);
    registry.setReady("parked", true);
    restored.measure.mockReturnValue(new DOMRect(10, -100, 200, 40));
    parked.measure.mockReturnValue(new DOMRect(10, -100, 200, 40));
    registry.measure(viewport);
    expect(restored.element.style.opacity).toBe("");
    expect(parked.element.style.opacity).toBe("0");
    expect(registry.get("parked")).toMatchObject({
      visible: false,
      ready: true,
    });
    restored.measure.mockReturnValue(new DOMRect(10, 30, 200, 40));
    registry.measure(viewport);
    expect(restored.element.style.opacity).toBe("0");
  });

  test("ignores stale asynchronous readiness and cleanup after same-id remount", async () => {
    const registry = createRegistry();
    const first = createTarget();
    const unregisterFirst = registry.register("title", first.element, {
      hideWhenReady: true,
    });
    const firstState = registry.get("title");
    if (!firstState) throw new Error("Expected the first target registration.");
    let finishLoad: () => void = () => undefined;
    const loading = new Promise<void>((resolve) => {
      finishLoad = resolve;
    }).then(() => registry.setReady("title", true, firstState));
    const replacement = createTarget();
    registry.register("title", replacement.element, { hideWhenReady: true });
    registry.measure(viewport);
    registry.setAvailable(true);
    unregisterFirst();
    finishLoad();
    await loading;
    expect(registry.get("title")?.element).toBe(replacement.element);
    expect(registry.get("title")?.ready).toBe(false);
    expect(replacement.element.style.opacity).toBe("");
  });

  test("limits fallback hiding to registered leaves so nested fallback remains visible", () => {
    const registry = createRegistry();
    const parent = createTarget();
    const child = createTarget();
    parent.element.append(child.element);
    registry.register("parent", parent.element, { hideWhenReady: true });
    registry.register("child", child.element, { hideWhenReady: true });
    registry.measure(viewport);
    registry.setAvailable(true);
    registry.setReady("parent", true);
    expect(parent.element.style.opacity).toBe("");
    expect(child.element.style.opacity).toBe("");
    registry.setReady("child", true);
    expect(child.element.style.opacity).toBe("0");
    registry.dispose();
    expect(parent.element.style.opacity).toBe("");
    expect(child.element.style.opacity).toBe("");
  });

  test("invalidates on content, inherited theme, resize, and captured scroll without an opacity loop", async () => {
    const invalidate = vi.fn();
    const registry = createRegistry(invalidate);
    const { element } = createTarget();
    registry.register("title", element, { hideWhenReady: true });
    registry.measure(viewport);
    registry.setAvailable(true);
    registry.setReady("title", true);
    invalidate.mockClear();
    await Promise.resolve();
    expect(invalidate).not.toHaveBeenCalled();
    const before = registry.get("title")?.revision ?? 0;
    element.textContent = "Updated text";
    document.body.classList.add("theme-dark");
    await Promise.resolve();
    expect(invalidate).toHaveBeenCalled();
    expect(registry.get("title")?.revision).toBeGreaterThan(before);
    invalidate.mockClear();
    element.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    expect(invalidate).toHaveBeenCalledTimes(2);
    registry.dispose();
    invalidate.mockClear();
    window.dispatchEvent(new Event("resize"));
    expect(invalidate).not.toHaveBeenCalled();
  });

  test("preserves explicit opacity priority and avoids restoring over consumer changes", () => {
    const registry = createRegistry();
    const { element } = createTarget();
    element.style.setProperty("opacity", "0.65", "important");
    registry.register("title", element, { hideWhenReady: true });
    registry.measure(viewport);
    registry.setAvailable(true);
    registry.setReady("title", true);
    registry.setReady("title", false);
    expect(element.style.getPropertyValue("opacity")).toBe("0.65");
    expect(element.style.getPropertyPriority("opacity")).toBe("important");
    registry.setReady("title", true);
    element.style.opacity = "0.4";
    registry.dispose();
    registry.dispose();
    expect(element.style.opacity).toBe("0.4");
  });

  test.each([
    "restore fallback",
    "measure before restoring",
    "dispose",
  ] as const)(
    "preserves consumer opacity priority when it must %s",
    (operation) => {
      const registry = createRegistry();
      const { element } = createTarget();
      registry.register("title", element, { hideWhenReady: true });
      registry.measure(viewport);
      registry.setAvailable(true);
      registry.setReady("title", true);

      element.style.setProperty("opacity", "0", "important");
      if (operation === "measure before restoring") registry.measure(viewport);
      if (operation === "dispose") registry.dispose();
      else registry.setReady("title", false);

      expect(element.style.opacity).toBe("0");
      expect(element.style.getPropertyPriority("opacity")).toBe("important");
    },
  );

  test.each([
    "hide fallback",
    "restore fallback",
    "measure without an opacity write",
  ] as const)(
    "keeps pending consumer style invalidation when it must %s",
    async (operation) => {
      const invalidate = vi.fn();
      const registry = createRegistry(invalidate);
      const { element } = createTarget();
      registry.register("title", element, { hideWhenReady: true });
      registry.measure(viewport);
      registry.setAvailable(true);
      if (operation !== "hide fallback") registry.setReady("title", true);
      await Promise.resolve();
      const before = registry.get("title")?.revision ?? 0;
      invalidate.mockClear();

      element.style.color = "red";
      if (operation === "hide fallback") registry.setReady("title", true);
      else if (operation === "restore fallback")
        registry.setReady("title", false);
      else registry.measure(viewport);
      await Promise.resolve();

      expect(element.style.color).toBe("red");
      expect(registry.get("title")?.revision).toBe(before + 1);
      expect(invalidate).toHaveBeenCalled();

      invalidate.mockClear();
      registry.measure(viewport);
      await Promise.resolve();
      expect(registry.get("title")?.revision).toBe(before + 1);
      expect(invalidate).not.toHaveBeenCalled();
    },
  );

  test("invalidates font completion and releases all observers on disposal", async () => {
    const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    const originalResizeObserver = window.ResizeObserver;
    const fonts = Object.assign(new EventTarget(), {
      ready: Promise.resolve(),
    });
    const observer: ResizeObserver = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
    let onResize: ResizeObserverCallback = () => undefined;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: fonts,
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: function createResizeObserver(callback: ResizeObserverCallback) {
        onResize = callback;
        return observer;
      },
    });
    try {
      const invalidate = vi.fn();
      const registry = createRegistry(invalidate);
      const { element } = createTarget();
      const unregister = registry.register("title", element);
      expect(observer.observe).toHaveBeenCalledWith(element);
      await fonts.ready;
      const revision = registry.get("title")?.revision ?? 0;
      fonts.dispatchEvent(new Event("loadingdone"));
      expect(registry.get("title")?.revision).toBe(revision + 1);
      onResize(
        [
          {
            target: element,
            contentRect: new DOMRect(0, 0, 200, 40),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        observer,
      );
      expect(registry.get("title")?.revision).toBe(revision + 2);
      unregister();
      expect(observer.unobserve).toHaveBeenCalledWith(element);
      registry.dispose();
      expect(observer.disconnect).toHaveBeenCalledTimes(1);
      invalidate.mockClear();
      fonts.dispatchEvent(new Event("loadingdone"));
      expect(invalidate).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "ResizeObserver", {
        configurable: true,
        value: originalResizeObserver,
      });
      if (originalFonts)
        Object.defineProperty(document, "fonts", originalFonts);
      else Reflect.deleteProperty(document, "fonts");
    }
  });
});
