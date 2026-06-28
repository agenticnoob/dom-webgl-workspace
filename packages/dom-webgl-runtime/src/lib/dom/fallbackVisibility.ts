import type { WebGLLifecycleDeclaration } from "../types";
import {
  isManagedFallbackRoot,
  isManagedFallbackRootHidden,
  markManagedFallbackRootHidden,
  markManagedFallbackRootVisible,
} from "./fallbackBoundary";

export type FallbackHideMode = NonNullable<
  WebGLLifecycleDeclaration["hideMode"]
>;

export type FallbackVisibilityController = {
  hide(): void;
  restore(): void;
};

type FallbackVisibilityOptions = {
  defaultHideWhenReady?: boolean;
  defaultHideMode?: FallbackHideMode;
  key?: string;
};

type ElementSnapshot = {
  element: Element;
  className: string | null;
  style: string | null;
};

type FallbackStyleSnapshot = {
  visibility: string;
};

const fallbackStyleSnapshots = new WeakMap<HTMLElement, FallbackStyleSnapshot>();

export function createFallbackVisibilityController(
  element: HTMLElement,
  lifecycle: WebGLLifecycleDeclaration,
  options: FallbackVisibilityOptions = {},
): FallbackVisibilityController {
  const hideWhenReady =
    lifecycle.hideWhenReady ?? options.defaultHideWhenReady ?? false;

  if (!hideWhenReady) {
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
  const ownerKey = options.key?.trim() ?? "";
  let hidden = false;
  let snapshots: ElementSnapshot[] = [];

  return {
    hide(): void {
      if (hidden) {
        return;
      }

      hidden = true;
      snapshots = snapshotElements(element);
      fallbackStyleSnapshots.set(element, {
        visibility:
          element.ownerDocument.defaultView?.getComputedStyle(element).visibility ||
          "visible",
      });

      if (ownerKey) {
        markManagedFallbackRootHidden(element, ownerKey);
      }

      for (const snapshot of snapshots) {
        applyHiddenStyle(element, snapshot.element, hideMode);
      }
    },
    restore(): void {
      if (!hidden) {
        return;
      }

      for (const snapshot of snapshots) {
        if (
          snapshot.element !== element &&
          isManagedFallbackRoot(snapshot.element) &&
          isManagedFallbackRootHidden(snapshot.element)
        ) {
          continue;
        }

        restoreAttribute(snapshot.element, "class", snapshot.className);
        restoreAttribute(snapshot.element, "style", snapshot.style);
      }

      hidden = false;
      snapshots = [];
      fallbackStyleSnapshots.delete(element);

      if (ownerKey) {
        markManagedFallbackRootVisible(element, ownerKey);
      }
    },
  };
}

export function readFallbackStyleSnapshot(
  element: HTMLElement,
): FallbackStyleSnapshot | undefined {
  return fallbackStyleSnapshots.get(element);
}

function snapshotElements(element: HTMLElement): ElementSnapshot[] {
  const elements: Element[] = [element];

  for (const child of element.querySelectorAll("*")) {
    if (hasManagedRootAncestorBetween(element, child)) {
      continue;
    }

    elements.push(child);
  }

  return elements.map((target) => ({
    element: target,
    className: target.getAttribute("class"),
    style: target.getAttribute("style"),
  }));
}

function applyHiddenStyle(
  owner: HTMLElement,
  target: Element,
  hideMode: FallbackHideMode,
): void {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target === owner) {
    target.style.visibility = "hidden";
    return;
  }

  if (isNestedManagedFallbackBoundary(owner, target)) {
    if (
      !isManagedFallbackRootHidden(target) &&
      !fallbackStyleSnapshots.has(target)
    ) {
      target.style.visibility = "visible";
    }
    return;
  }

  target.style.visibility = hideMode === "self" ? "visible" : "hidden";
}

function isNestedManagedFallbackBoundary(
  owner: HTMLElement,
  target: Element,
): target is HTMLElement {
  return (
    target !== owner &&
    target instanceof HTMLElement &&
    (isManagedFallbackRoot(target) || fallbackStyleSnapshots.has(target))
  );
}

function hasManagedRootAncestorBetween(
  owner: HTMLElement,
  target: Element,
): boolean {
  let parent = target.parentElement;

  while (parent && parent !== owner) {
    if (isManagedFallbackRoot(parent) || fallbackStyleSnapshots.has(parent)) {
      return true;
    }

    parent = parent.parentElement;
  }

  return false;
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
