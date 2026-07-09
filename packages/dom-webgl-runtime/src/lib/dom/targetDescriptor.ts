import type { WebGLDeclaration } from "../types";
import { normalizeScrollBehavior } from "../input/scrollDeclaration";
import {
  normalizeTimelineBinding,
  type NormalizedTimelineBinding,
} from "../timeline/timelineDeclarations";

export type NormalizedTargetDeclaration = Omit<WebGLDeclaration, "timeline"> & {
  readonly timeline?: NormalizedTimelineBinding;
};

export type TargetDescriptor = {
  key: string;
  element: HTMLElement;
  scanOrder: number;
  declaration: NormalizedTargetDeclaration;
};

export function createTargetDescriptor(
  element: HTMLElement,
  declaration: WebGLDeclaration,
  scanOrder: number,
): TargetDescriptor {
  const key = declaration.key.trim();
  const { timeline, ...targetDeclaration } = declaration;

  if (!key) {
    throw new Error("WebGL target declaration requires a non-empty key.");
  }

  return {
    key,
    element,
    scanOrder,
    declaration: {
      ...targetDeclaration,
      key,
      scroll: normalizeScrollBehavior(declaration.scroll),
      ...(timeline !== undefined
        ? { timeline: normalizeTimelineBinding(timeline) }
        : {}),
      pointer: declaration.pointer ?? {},
      lifecycle: declaration.lifecycle ?? {},
    },
  };
}
