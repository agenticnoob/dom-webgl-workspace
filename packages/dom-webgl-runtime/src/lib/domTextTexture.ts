import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

import { drawDOMText, measureDOMText } from "./domTextLayout";

export type DOMTextTexture = {
  texture: CanvasTexture;
  width: number;
  height: number;
  dispose(): void;
};

export function createDOMTextTexture(
  element: HTMLElement,
  options: { devicePixelRatio?: number } = {},
): DOMTextTexture {
  const canvas = element.ownerDocument.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("DOM text textures require a 2D canvas context.");
  const layout = measureDOMText(element, { ...options, context });
  canvas.width = Math.max(1, Math.ceil(layout.width * layout.devicePixelRatio));
  canvas.height = Math.max(
    1,
    Math.ceil(layout.height * layout.devicePixelRatio),
  );
  context.setTransform(
    layout.devicePixelRatio,
    0,
    0,
    layout.devicePixelRatio,
    0,
    0,
  );
  drawDOMText(context, layout);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  let disposed = false;
  return {
    texture,
    width: layout.width,
    height: layout.height,
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
    },
  };
}
