import type { WebGLLifecycleDeclaration } from "../types";

export type FallbackHideMode = NonNullable<
  WebGLLifecycleDeclaration["hideMode"]
>;

export type FallbackVisibilityController = {
  hide(): void;
  restore(): void;
};

type FallbackVisibilityOptions = {
  defaultHideMode?: FallbackHideMode;
};

type ElementSnapshot = {
  element: Element;
  className: string | null;
  style: string | null;
};

export function createFallbackVisibilityController(
  element: HTMLElement,
  lifecycle: WebGLLifecycleDeclaration,
  options: FallbackVisibilityOptions = {},
): FallbackVisibilityController {
  if (!lifecycle.hideWhenReady) {
    return {
      hide() {
        return;
      },
      restore() {
        return;
      },
    };
  }

  const hideMode = lifecycle.hideMode ?? options.defaultHideMode ?? "subtree";
  let hidden = false;
  let snapshots: ElementSnapshot[] = [];

  return {
    hide(): void {
      if (hidden) {
        return;
      }

      hidden = true;
      snapshots = snapshotElements(element, hideMode);
      element.style.visibility = "hidden";

      for (const child of element.querySelectorAll<HTMLElement>("*")) {
        child.style.visibility = hideMode === "self" ? "visible" : "hidden";
      }
    },
    restore(): void {
      if (!hidden) {
        return;
      }

      for (const snapshot of snapshots) {
        restoreAttribute(snapshot.element, "class", snapshot.className);
        restoreAttribute(snapshot.element, "style", snapshot.style);
      }

      hidden = false;
      snapshots = [];
    },
  };
}

function snapshotElements(
  element: HTMLElement,
  hideMode: FallbackHideMode,
): ElementSnapshot[] {
  const elements: Element[] = [element];

  if (hideMode === "self" || hideMode === "subtree") {
    elements.push(...element.querySelectorAll("*"));
  }

  return elements.map((target) => ({
    element: target,
    className: target.getAttribute("class"),
    style: target.getAttribute("style"),
  }));
}

function restoreAttribute(
  element: Element,
  attribute: "class" | "style",
  value: string | null,
): void {
  if (value === null) {
    element.removeAttribute(attribute);
    return;
  }

  element.setAttribute(attribute, value);
}
