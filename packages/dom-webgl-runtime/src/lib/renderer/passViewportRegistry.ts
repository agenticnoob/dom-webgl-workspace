import type { WebGLPassViewportDeclaration } from "../types";

export type PassViewportAnchorDeclaration = {
  id: string;
  element: HTMLElement;
};

export type ResolvedPassViewport =
  | { mode: "canvas" }
  | {
      mode: "dom-rect";
      anchorId: string;
      scissor: boolean;
      rect: { x: number; y: number; width: number; height: number };
    };

export type PassViewportRegistry = {
  register(declaration: PassViewportAnchorDeclaration): void;
  unregister(id: string): void;
  resolve(declaration: WebGLPassViewportDeclaration | undefined): ResolvedPassViewport;
  dispose(): void;
};

export function createPassViewportRegistry(): PassViewportRegistry {
  const anchorsById = new Map<string, HTMLElement>();
  let disposed = false;

  return {
    register({ id, element }) {
      if (disposed) {
        throw new Error(
          "Cannot register a WebGL pass viewport after runtime disposal.",
        );
      }

      const normalizedId = normalizeViewportAnchorId(id);
      if (anchorsById.has(normalizedId)) {
        throw new Error(
          `WebGL pass viewport anchor id "${normalizedId}" is already registered.`,
        );
      }

      anchorsById.set(normalizedId, element);
    },
    unregister(id) {
      anchorsById.delete(id.trim());
    },
    resolve(declaration) {
      if (!declaration || declaration.mode !== "dom-rect") {
        return { mode: "canvas" };
      }

      if (!declaration.anchorId) {
        throw new Error(
          "WebGL pass viewport dom-rect mode requires an anchorId after React context normalization.",
        );
      }

      const anchorId = normalizeViewportAnchorId(declaration.anchorId);
      const element = anchorsById.get(anchorId);
      if (!element) {
        throw new Error(`Unknown WebGL pass viewport anchor "${anchorId}".`);
      }

      const rect = element.getBoundingClientRect();
      return {
        mode: "dom-rect",
        anchorId,
        scissor: declaration.scissor ?? true,
        rect: {
          x: normalizeViewportNumber(rect.left),
          y: normalizeViewportNumber(rect.top),
          width: normalizeViewportNumber(rect.width),
          height: normalizeViewportNumber(rect.height),
        },
      };
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      anchorsById.clear();
    },
  };
}

function normalizeViewportAnchorId(id: string): string {
  const normalized = id.trim();
  if (!normalized) {
    throw new Error("WebGL pass viewport anchor id must be a non-empty string.");
  }

  return normalized;
}

function normalizeViewportNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
