export type DOMResizeInvalidationObserver = {
  observe(target: Element): void;
  unobserve?(target: Element): void;
  disconnect(): void;
};

export type DOMInvalidationController = {
  observeTarget(target: { key: string; element: HTMLElement }): void;
  unobserveTarget(key: string): void;
  notifyViewportChanged(): void;
  consumeDirtyKeys(): Set<string>;
  dispose(): void;
};

export type DOMInvalidationControllerOptions = {
  onDirtyTarget?(key: string): void;
  createResizeObserver?(
    callback: ResizeObserverCallback,
  ): DOMResizeInvalidationObserver;
  windowTarget?: {
    addEventListener?(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ): void;
    removeEventListener?(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ): void;
    visualViewport?: {
      addEventListener?(
        type: string,
        listener: EventListenerOrEventListenerObject,
      ): void;
      removeEventListener?(
        type: string,
        listener: EventListenerOrEventListenerObject,
      ): void;
    } | null;
  };
};

export function createDOMInvalidationController(
  options: DOMInvalidationControllerOptions = {},
): DOMInvalidationController {
  const targets = new Map<string, HTMLElement>();
  const keysByElement = new Map<Element, string>();
  const dirtyKeys = new Set<string>();
  const resizeObserver = createResizeObserver(options);
  const windowTarget = options.windowTarget ?? globalThis.window;
  const handleViewportChanged = () => {
    for (const key of targets.keys()) {
      markDirty(key);
    }
  };

  windowTarget?.addEventListener?.("resize", handleViewportChanged);
  windowTarget?.addEventListener?.("orientationchange", handleViewportChanged);
  windowTarget?.visualViewport?.addEventListener?.(
    "resize",
    handleViewportChanged,
  );
  windowTarget?.visualViewport?.addEventListener?.(
    "scroll",
    handleViewportChanged,
  );

  return {
    observeTarget(target): void {
      targets.set(target.key, target.element);
      keysByElement.set(target.element, target.key);
      resizeObserver?.observe(target.element);
    },
    unobserveTarget(key): void {
      const element = targets.get(key);

      if (!element) {
        return;
      }

      resizeObserver?.unobserve?.(element);
      targets.delete(key);
      keysByElement.delete(element);
      dirtyKeys.delete(key);
    },
    notifyViewportChanged(): void {
      handleViewportChanged();
    },
    consumeDirtyKeys(): Set<string> {
      const consumed = new Set(dirtyKeys);

      dirtyKeys.clear();

      return consumed;
    },
    dispose(): void {
      targets.clear();
      keysByElement.clear();
      dirtyKeys.clear();
      resizeObserver?.disconnect();
      windowTarget?.removeEventListener?.("resize", handleViewportChanged);
      windowTarget?.removeEventListener?.(
        "orientationchange",
        handleViewportChanged,
      );
      windowTarget?.visualViewport?.removeEventListener?.(
        "resize",
        handleViewportChanged,
      );
      windowTarget?.visualViewport?.removeEventListener?.(
        "scroll",
        handleViewportChanged,
      );
    },
  };

  function markDirty(key: string): void {
    if (!targets.has(key)) {
      return;
    }

    dirtyKeys.add(key);
    options.onDirtyTarget?.(key);
  }

  function markResizeDirty(entries: ResizeObserverEntry[]): void {
    if (entries.length === 0) {
      markAllDirty();
      return;
    }

    for (const entry of entries) {
      const key = keysByElement.get(entry.target);

      if (key) {
        markDirty(key);
      }
    }
  }

  function markAllDirty(): void {
    for (const key of targets.keys()) {
      markDirty(key);
    }
  }

  function createResizeObserver(
    observerOptions: DOMInvalidationControllerOptions,
  ): DOMResizeInvalidationObserver | undefined {
    if (observerOptions.createResizeObserver) {
      return observerOptions.createResizeObserver(markResizeDirty);
    }

    if (typeof globalThis.ResizeObserver === "function") {
      return new globalThis.ResizeObserver(markResizeDirty);
    }

    return undefined;
  }

}
