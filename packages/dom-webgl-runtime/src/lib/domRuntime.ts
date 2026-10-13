export type DOMTargetRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type DOMTargetOptions = {
  hideWhenReady?: boolean;
  offscreen?: "park" | "restore-dom";
};

export type DOMTargetState = {
  readonly id: string;
  readonly element: HTMLElement;
  readonly offscreen: "park" | "restore-dom";
  rect: DOMTargetRect;
  visible: boolean;
  ready: boolean;
  /** Changes when content, typography, or dimensions need a fresh snapshot. */
  revision: number;
};

export type DOMTargetSnapshot = Omit<DOMTargetState, "element"> & {
  hidden: boolean;
};

export type DOMTargetRegistry = {
  register(
    id: string,
    element: HTMLElement,
    options?: DOMTargetOptions,
  ): () => void;
  get(id: string): DOMTargetState | undefined;
  measure(viewport: { width: number; height: number }): void;
  /** Pass the captured target for asynchronous readiness notifications. */
  setReady(id: string, ready: boolean, expected?: DOMTargetState): void;
  setAvailable(available: boolean): void;
  inspect(): DOMTargetSnapshot[];
  dispose(): void;
};

type TargetEntry = {
  state: DOMTargetState;
  hideWhenReady: boolean;
  hidden: boolean;
  savedOpacity: string;
  savedPriority: string;
  initialStyle: string | null;
  appliedOpacity: string | undefined;
  appliedPriority: string | undefined;
};

export function createDOMTargetRegistry(
  invalidate: () => void,
): DOMTargetRegistry {
  const entries = new Map<string, TargetEntry>();
  const ownStyles = new WeakMap<Node, string | null>();
  let disposed = false;
  let available = false;
  let documentTarget: Document | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;
  let stopWatching: (() => void) | undefined;

  function wake(): void {
    if (!disposed) invalidate();
  }

  function invalidateContent(): void {
    for (const entry of entries.values()) entry.state.revision += 1;
    wake();
  }

  function markContentChanged(node: Node): void {
    for (const entry of entries.values()) {
      const element = entry.state.element;
      if (element.contains(node) || node.contains(element)) {
        entry.state.revision += 1;
      }
    }
  }

  function preservePendingStyleChange(entry: TargetEntry): void {
    const element = entry.state.element;
    const previousStyle = ownStyles.has(element)
      ? ownStyles.get(element)
      : entry.initialStyle;
    if (previousStyle !== element.getAttribute("style")) {
      // The observer has not delivered this consumer write yet. Account for it
      // before recording the combined style as our own opacity mutation.
      markContentChanged(element);
    }
  }

  function watch(document: Document): void {
    if (documentTarget) return;
    documentTarget = document;
    const view = document.defaultView;
    if (!view) return;

    if (typeof view.ResizeObserver === "function") {
      resizeObserver = new view.ResizeObserver((changes) => {
        for (const change of changes) {
          for (const entry of entries.values()) {
            if (entry.state.element === change.target)
              entry.state.revision += 1;
          }
        }
        wake();
      });
    }

    if (typeof view.MutationObserver === "function") {
      mutationObserver = new view.MutationObserver((changes) => {
        let changed = false;
        for (const change of changes) {
          if (
            change.type === "attributes" &&
            change.attributeName === "style"
          ) {
            const element = change.target;
            if (element instanceof view.Element) {
              const style = element.getAttribute("style");
              if (ownStyles.has(element) && ownStyles.get(element) === style)
                continue;
              ownStyles.set(element, style);
            }
          }
          changed = true;
          markContentChanged(change.target);
        }
        if (changed) wake();
      });
      mutationObserver.observe(document.documentElement, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    view.addEventListener("resize", invalidateContent);
    view.addEventListener("scroll", wake, { capture: true, passive: true });
    view.visualViewport?.addEventListener("resize", invalidateContent);
    view.visualViewport?.addEventListener("scroll", wake);
    document.fonts?.addEventListener("loadingdone", invalidateContent);
    document.fonts?.ready.then(invalidateContent);
    stopWatching = () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      view.removeEventListener("resize", invalidateContent);
      view.removeEventListener("scroll", wake, { capture: true });
      view.visualViewport?.removeEventListener("resize", invalidateContent);
      view.visualViewport?.removeEventListener("scroll", wake);
      document.fonts?.removeEventListener("loadingdone", invalidateContent);
    };
  }

  function restoreOpacity(entry: TargetEntry): void {
    if (entry.appliedOpacity === undefined) return;
    const style = entry.state.element.style;
    if (
      style.getPropertyValue("opacity") === entry.appliedOpacity &&
      style.getPropertyPriority("opacity") === entry.appliedPriority
    ) {
      preservePendingStyleChange(entry);
      if (entry.savedOpacity) {
        style.setProperty("opacity", entry.savedOpacity, entry.savedPriority);
      } else {
        style.removeProperty("opacity");
      }
      ownStyles.set(
        entry.state.element,
        entry.state.element.getAttribute("style"),
      );
    }
    entry.appliedOpacity = undefined;
    entry.appliedPriority = undefined;
  }

  function applyOpacity(entry: TargetEntry, value: string): void {
    const style = entry.state.element.style;
    if (
      entry.appliedOpacity === undefined ||
      style.opacity !== entry.appliedOpacity ||
      style.getPropertyPriority("opacity") !== entry.appliedPriority
    ) {
      entry.savedOpacity = style.getPropertyValue("opacity");
      entry.savedPriority = style.getPropertyPriority("opacity");
    }
    if (style.opacity !== value) {
      preservePendingStyleChange(entry);
      style.setProperty("opacity", value);
      ownStyles.set(
        entry.state.element,
        entry.state.element.getAttribute("style"),
      );
    }
    entry.appliedOpacity = value;
    entry.appliedPriority = style.getPropertyPriority("opacity");
  }

  function reconcileFallbacks(): void {
    for (const entry of entries.values()) {
      const hasRegisteredChild = Array.from(entries.values()).some(
        (child) =>
          child !== entry && entry.state.element.contains(child.state.element),
      );
      entry.hidden =
        !hasRegisteredChild &&
        available &&
        entry.hideWhenReady &&
        entry.state.ready &&
        (entry.state.visible || entry.state.offscreen === "park");
      if (entry.hidden) applyOpacity(entry, "0");
      else restoreOpacity(entry);
    }
  }

  function removeEntry(entry: TargetEntry): void {
    restoreOpacity(entry);
    resizeObserver?.unobserve(entry.state.element);
    if (entries.get(entry.state.id) === entry) entries.delete(entry.state.id);
  }

  return {
    register(id, element, options = {}) {
      if (disposed)
        throw new Error("Cannot register a DOM target after disposal.");
      watch(element.ownerDocument);
      const previous = entries.get(id);
      if (previous) removeEntry(previous);
      const entry: TargetEntry = {
        state: {
          id,
          element,
          offscreen: options.offscreen ?? "restore-dom",
          rect: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
          visible: false,
          ready: false,
          revision: 0,
        },
        hideWhenReady: options.hideWhenReady ?? false,
        hidden: false,
        savedOpacity: element.style.getPropertyValue("opacity"),
        savedPriority: element.style.getPropertyPriority("opacity"),
        initialStyle: element.getAttribute("style"),
        appliedOpacity: undefined,
        appliedPriority: undefined,
      };
      entries.set(id, entry);
      resizeObserver?.observe(element);
      reconcileFallbacks();
      wake();
      return () => {
        if (entries.get(id) !== entry) return;
        removeEntry(entry);
        reconcileFallbacks();
        wake();
      };
    },
    get(id) {
      return entries.get(id)?.state;
    },
    measure(viewport) {
      if (disposed) return;
      // All layout reads precede fallback writes to avoid forced layout per target.
      const measured = Array.from(entries.values(), (entry) => ({
        entry,
        rect: entry.state.element.getBoundingClientRect(),
      }));
      for (const { entry, rect } of measured) {
        const state = entry.state;
        if (
          state.rect.width !== rect.width ||
          state.rect.height !== rect.height
        ) {
          state.revision += 1;
        }
        state.rect = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
        state.visible =
          state.element.isConnected &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < viewport.width &&
          rect.top < viewport.height;
      }
      reconcileFallbacks();
    },
    setReady(id, ready, expected) {
      const entry = entries.get(id);
      if (
        !entry ||
        (expected && entry.state !== expected) ||
        entry.state.ready === ready
      )
        return;
      entry.state.ready = ready;
      reconcileFallbacks();
      wake();
    },
    setAvailable(nextAvailable) {
      if (disposed || available === nextAvailable) return;
      available = nextAvailable;
      reconcileFallbacks();
      wake();
    },
    inspect() {
      return Array.from(entries.values(), ({ state, hidden }) => ({
        id: state.id,
        rect: { ...state.rect },
        visible: state.visible,
        ready: state.ready,
        offscreen: state.offscreen,
        revision: state.revision,
        hidden,
      }));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopWatching?.();
      for (const entry of entries.values()) restoreOpacity(entry);
      entries.clear();
    },
  };
}
