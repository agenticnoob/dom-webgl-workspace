import { vi } from "vitest";

const testWindow = globalThis.window;

if (testWindow && !testWindow.matchMedia) {
  Object.defineProperty(testWindow, "matchMedia", {
    configurable: true,
    writable: true,
    value(query: string): MediaQueryList {
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    },
  });
}

if (!globalThis.ResizeObserver) {
  class ResizeObserverMock implements ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
}
