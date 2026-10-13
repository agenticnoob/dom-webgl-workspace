import { afterEach, describe, expect, it, vi } from "vitest";
import { createRuntimeManager } from "../src/lib/runtimeManager";

function target() {
  const element = document.createElement("p");
  element.textContent = "Semantic content";
  document.body.append(element);
  element.getBoundingClientRect = () => ({
    x: 20,
    y: 30,
    left: 20,
    top: 30,
    right: 220,
    bottom: 80,
    width: 200,
    height: 50,
    toJSON() {},
  });
  return element;
}

describe("runtime policy manager", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });
  it("keeps fallback until both its projection and renderer are ready, then restores it", () => {
    const controller = createRuntimeManager();
    const element = target();
    const remove = controller.register("title", element, {
      hideWhenReady: true,
    });
    controller.measure({ width: 800, height: 600 });
    controller.manager.setTargetReady("title", true);
    expect(element.style.opacity).not.toBe("0");
    controller.setAvailable(true);
    expect(element.style.opacity).toBe("0");
    controller.setAvailable(false, new Error("Context lost"));
    expect(element.style.opacity).not.toBe("0");
    expect(controller.manager.getDebugState().error).toBe("Context lost");
    controller.setAvailable(false);
    expect(controller.manager.getDebugState().error).toBe("Context lost");
    controller.setAvailable(true);
    expect(controller.manager.getDebugState().error).toBeUndefined();
    remove();
    expect(element.style.opacity).not.toBe("0");
    expect(controller.manager.getDebugState().targetCount).toBe(0);
    controller.dispose();
  });

  it("uses current external progress/scroll without owning or disposing those sources", () => {
    const controller = createRuntimeManager();
    const dispose = vi.fn();
    controller.configure({
      progressSignals: { get: () => 0.4 },
      scrollAdapter: {
        readMetrics: () => ({
          scrollY: 40,
          scrollHeight: 900,
          viewportHeight: 500,
        }),
        dispose,
      },
    });
    expect(controller.manager.progress.get("chapter")).toBe(0.4);
    expect(controller.manager.scroll.scrollY).toBe(40);
    controller.configure({ progressSignals: { get: () => 0.8 } });
    expect(controller.manager.progress.get("chapter")).toBe(0.8);
    controller.dispose();
    controller.dispose();
    expect(dispose).not.toHaveBeenCalled();
    expect(() => controller.register("late", target(), {})).toThrow("disposal");
  });

  it("invalidates the R3F root and unsubscribes without a second scheduler", () => {
    const controller = createRuntimeManager();
    const invalidate = vi.fn();
    const listener = vi.fn();
    const disconnect = controller.connect(invalidate);
    const unsubscribe = controller.manager.subscribe(listener);
    const remove = controller.register("title", target(), {});
    expect(listener).toHaveBeenCalledOnce();
    controller.manager.invalidate();
    expect(invalidate).toHaveBeenCalled();
    unsubscribe();
    remove();
    expect(listener).toHaveBeenCalledOnce();
    disconnect();
    invalidate.mockClear();
    controller.manager.invalidate();
    expect(invalidate).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("ignores stale cleanup after a target with the same id remounts", () => {
    const controller = createRuntimeManager();
    const oldRemove = controller.register("title", target(), {});
    const current = target();
    const remove = controller.register("title", current, {});
    oldRemove();
    expect(controller.manager.getTarget("title")?.element).toBe(current);
    expect(controller.manager.getDebugState().targetCount).toBe(1);
    remove();
    expect(controller.manager.getDebugState().targetCount).toBe(0);
    controller.dispose();
  });
});
