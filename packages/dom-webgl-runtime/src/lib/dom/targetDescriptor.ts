import type { WebGLDeclaration } from "../types";

export type TargetDescriptor = {
  key: string;
  element: HTMLElement;
  scanOrder: number;
  declaration: WebGLDeclaration;
};

export function createTargetDescriptor(
  element: HTMLElement,
  declaration: WebGLDeclaration,
  scanOrder: number,
): TargetDescriptor {
  const key = declaration.key.trim();

  if (!key) {
    throw new Error("WebGL target declaration requires a non-empty key.");
  }

  return {
    key,
    element,
    scanOrder,
    declaration: {
      ...declaration,
      key,
      scroll: declaration.scroll ?? { type: "page" },
      pointer: declaration.pointer ?? {},
      lifecycle: declaration.lifecycle ?? {},
    },
  };
}
