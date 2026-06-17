export type DOMViewportSize = {
  width: number;
  height: number;
};

export type ProjectedDOMRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function projectDOMRectToSceneLayout(
  rect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  viewport: DOMViewportSize,
): ProjectedDOMRect {
  return {
    x: rect.left + rect.width / 2,
    y: viewport.height - (rect.top + rect.height / 2),
    width: rect.width,
    height: rect.height,
  };
}
