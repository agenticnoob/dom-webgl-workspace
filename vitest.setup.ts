import { vi } from "vitest";

const testWindow = globalThis.window;

if (!globalThis.requestAnimationFrame) {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value(callback: FrameRequestCallback): number {
      return setTimeout(() => callback(Date.now()), 16) as unknown as number;
    },
  });
}

if (!globalThis.cancelAnimationFrame) {
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value(handle: number): void {
      clearTimeout(handle);
    },
  });
}

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
