import { describe, expect, test, vi } from "vitest";

import { createDOMInvalidationController } from "../../../src/lib/dom/domInvalidation";

describe("createDOMInvalidationController", () => {
  test("notifies dirty targets for size and viewport changes", () => {
    const dirtyKeys: string[] = [];
    const target = document.createElement("section");
    const controller = createDOMInvalidationController({
      onDirtyTarget: (key) => dirtyKeys.push(key),
      createResizeObserver(callback) {
        return createObserverStub(() => callback([], {} as ResizeObserver));
      },
      windowTarget: window,
    });

    controller.observeTarget({ key: "hero", element: target });
    controller.notifyViewportChanged();

    expect(dirtyKeys).toContain("hero");
    expect(controller.consumeDirtyKeys()).toEqual(new Set(["hero"]));
    expect(controller.consumeDirtyKeys()).toEqual(new Set());

    controller.unobserveTarget("hero");
    controller.dispose();
  });

  test("observes target resize and cleans up listeners without tracking style mutations", () => {
    const resizeObserve = vi.fn();
    const disconnect = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const target = document.createElement("section");
    const controller = createDOMInvalidationController({
      createResizeObserver() {
        return {
          observe: resizeObserve,
          unobserve: vi.fn(),
          disconnect,
        };
      },
      windowTarget: {
        addEventListener,
        removeEventListener,
      },
    });

    controller.observeTarget({ key: "card", element: target });
    controller.dispose();

    expect(resizeObserve).toHaveBeenCalledWith(target);
    expect(addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    expect(disconnect).toHaveBeenCalled();
  });

  test("marks only the observer target dirty when entries identify a target", () => {
    const dirtyKeys: string[] = [];
    let resizeCallback: ResizeObserverCallback | undefined;
    const first = document.createElement("section");
    const second = document.createElement("section");
    const controller = createDOMInvalidationController({
      onDirtyTarget: (key) => dirtyKeys.push(key),
      createResizeObserver(callback) {
        resizeCallback = callback;
        return {
          observe: () => {},
          unobserve: () => {},
          disconnect: () => {},
        };
      },
    });

    controller.observeTarget({ key: "first", element: first });
    controller.observeTarget({ key: "second", element: second });
    resizeCallback?.(
      [{ target: second } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );

    expect(dirtyKeys).toEqual(["second"]);
    expect(controller.consumeDirtyKeys()).toEqual(new Set(["second"]));
  });
});

function createObserverStub(callback: () => void) {
  return {
    observe: () => callback(),
    unobserve: () => {},
    disconnect: () => {},
  };
}
